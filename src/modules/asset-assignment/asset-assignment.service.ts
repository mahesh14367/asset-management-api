import mongoose from 'mongoose';
import {
  AssetAssignment,
  HardwareAssignment,
  LicenseAssignment,
  HardwareAssignmentStatus,
  LicenseAssignmentStatus,
  IHardwareAssignment,
  ILicenseAssignment,
} from './asset-assignment.model';
import { Asset, HardwareAsset, SoftwareLicenseAsset, AssetStatus, AssetCondition, IAsset } from '../asset/asset.model';
import { Employee, IEmployee, EmploymentStatus } from '../employee/employee.model';
import { IUser } from '../user/user.model';
import ApiError from '../../utils/ApiError';
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination.util';
import { createAuditLog, buildActorSnapshot, AuditAction } from '../audit-log';
import { AuditMetadata } from '../audit-log/audit-log.model';

type Actor = Pick<IUser, '_id' | 'name' | 'email' | 'role'>;

interface AssignAssetInput {
  asset: string;
  employee: string;
  expectedReturnDate?: Date;
  conditionAtAssignment?: string;
  remarks?: string;
}

/**
 * Single public entry point for "assign this asset to this employee" — branches
 * internally by asset kind. This is the actual point of the merge you asked for:
 * one endpoint, one mental model for the caller, kind-specific mechanics underneath.
 */
export const assignAsset = async (input: AssignAssetInput, actor: Actor, metadata: AuditMetadata) => {
  const asset = await Asset.findById(input.asset);
  if (!asset) throw ApiError.notFound('Asset not found');

  const employee = await Employee.findById(input.employee);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.employmentStatus !== EmploymentStatus.ACTIVE) {
    throw ApiError.badRequest('Cannot assign an asset to an employee who is not active');
  }

  return asset.assetKind === 'hardware'
    ? assignHardware(asset, employee, input, actor, metadata)
    : assignLicenseSeat(asset, employee, input, actor, metadata);
};

// ---------------------------------------------------------------------------
// Hardware path — unchanged in substance from the original AssetAssignment logic,
// just now living on the HardwareAssignment discriminator.
// ---------------------------------------------------------------------------
const assignHardware = async (
  asset: IAsset,
  employee: IEmployee,
  input: AssignAssetInput,
  actor: Actor,
  metadata: AuditMetadata
) => {
  if (!input.conditionAtAssignment) {
    throw ApiError.badRequest('conditionAtAssignment is required when assigning a hardware asset');
  }
  if (asset.status !== AssetStatus.AVAILABLE) {
    throw ApiError.badRequest(`Asset is currently '${asset.status}' and cannot be assigned`);
  }

  const session = await mongoose.startSession();
  try {
    let assignment!: IHardwareAssignment;

    await session.withTransaction(async () => {
      const [created] = await HardwareAssignment.create(
        [
          {
            asset: asset._id,
            employee: employee._id,
            assignedDate: new Date(),
            expectedReturnDate: input.expectedReturnDate,
            conditionAtAssignment: input.conditionAtAssignment as AssetCondition,
            remarks: input.remarks,
            assignedBy: actor._id,
          },
        ],
        { session }
      );
      assignment = created;

      await Asset.findByIdAndUpdate(asset._id, { status: AssetStatus.ASSIGNED }, { session });
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.ASSET_ASSIGNED,
      entityType: 'Asset',
      entityId: asset._id.toString(),
      description: `Assigned ${asset.assetTag} (${asset.name}) to employee ${employee.employeeCode}`,
      metadata,
    });

    return sanitizeAssignment(assignment);
  } catch (err: any) {
    if (err.code === 11000) {
      throw ApiError.conflict('This asset was just assigned by another request. Please refresh and try again.');
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

// ---------------------------------------------------------------------------
// License path — capacity-gated, multi-holder. This is the logic that used to live
// in license-allocation.service.ts, relocated here (see deletion note below).
// ---------------------------------------------------------------------------
const assignLicenseSeat = async (
  asset: IAsset,
  employee: IEmployee,
  input: AssignAssetInput,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const session = await mongoose.startSession();
  try {
    let assignment!: ILicenseAssignment;

    await session.withTransaction(async () => {
      // Atomic capacity gate: condition + increment as ONE document operation, so two
      // concurrent requests racing for the last seat can never both succeed.
      const updatedLicense = await SoftwareLicenseAsset.findOneAndUpdate(
        { _id: asset._id, $expr: { $lt: ['$seatsAllocated', '$totalSeats'] } },
        { $inc: { seatsAllocated: 1 } },
        { new: true, session }
      );
      if (!updatedLicense) {
        throw ApiError.conflict('No available seats remain on this license');
      }

      const [created] = await LicenseAssignment.create(
        [
          {
            asset: asset._id,
            employee: employee._id,
            assignedDate: new Date(),
            remarks: input.remarks,
            assignedBy: actor._id,
          },
        ],
        { session }
      );
      assignment = created;
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.LICENSE_SEAT_ALLOCATED,
      entityType: 'Asset',
      entityId: asset._id.toString(),
      description: `Allocated a seat of ${asset.name} to employee ${employee.employeeCode}`,
      metadata,
    });

    return sanitizeAssignment(assignment);
  } catch (err: any) {
    if (err.code === 11000) {
      throw ApiError.conflict('This employee already holds an active seat on this license');
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

// ---------------------------------------------------------------------------
// Closing a hardware assignment — return or lost. Kind-checked: you cannot call this
// on a LicenseAssignment record, and the error says so explicitly rather than failing
// in a confusing way.
// ---------------------------------------------------------------------------
export const returnHardwareAsset = async (
  assignmentId: string,
  input: { conditionAtReturn: string; returnRemarks?: string },
  actor: Actor,
  metadata: AuditMetadata
) => {
  const assignment = await HardwareAssignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Hardware assignment record not found');
  if (assignment.status !== HardwareAssignmentStatus.ACTIVE) {
    throw ApiError.badRequest('This assignment is not currently active');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      assignment.status = HardwareAssignmentStatus.RETURNED;
      assignment.returnedDate = new Date();
      assignment.conditionAtReturn = input.conditionAtReturn as AssetCondition;
      assignment.returnRemarks = input.returnRemarks;
      assignment.returnedBy = actor._id;
      await assignment.save({ session });

      const newStatus = input.conditionAtReturn === 'damaged' ? AssetStatus.IN_REPAIR : AssetStatus.AVAILABLE;
      await Asset.findByIdAndUpdate(assignment.asset, { status: newStatus }, { session });
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.ASSET_RETURNED,
      entityType: 'Asset',
      entityId: assignment.asset.toString(),
      description: `Hardware asset returned, condition: ${input.conditionAtReturn}`,
      metadata,
    });

    return sanitizeAssignment(assignment);
  } finally {
    await session.endSession();
  }
};

export const reportHardwareAssetLost = async (
  assignmentId: string,
  remarks: string | undefined,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const assignment = await HardwareAssignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Hardware assignment record not found');
  if (assignment.status !== HardwareAssignmentStatus.ACTIVE) {
    throw ApiError.badRequest('This assignment is not currently active');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      assignment.status = HardwareAssignmentStatus.LOST;
      assignment.returnedDate = new Date();
      assignment.returnRemarks = remarks;
      assignment.returnedBy = actor._id;
      await assignment.save({ session });

      await Asset.findByIdAndUpdate(assignment.asset, { status: AssetStatus.LOST }, { session });
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.ASSET_STATUS_CHANGED,
      entityType: 'Asset',
      entityId: assignment.asset.toString(),
      description: `Hardware asset reported lost while assigned`,
      changes: { before: { status: AssetStatus.ASSIGNED }, after: { status: AssetStatus.LOST } },
      metadata,
    });

    return sanitizeAssignment(assignment);
  } finally {
    await session.endSession();
  }
};

// ---------------------------------------------------------------------------
// Revoking a license seat — kind-checked the same way.
// ---------------------------------------------------------------------------
export const revokeLicenseSeat = async (
  assignmentId: string,
  revokeRemarks: string | undefined,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const assignment = await LicenseAssignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('License assignment record not found');
  if (assignment.status !== LicenseAssignmentStatus.ACTIVE) {
    throw ApiError.badRequest('This seat allocation is not currently active');
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      assignment.status = LicenseAssignmentStatus.REVOKED;
      assignment.revokedDate = new Date();
      assignment.revokedBy = actor._id;
      if (revokeRemarks) assignment.revokeRemarks = revokeRemarks;
      await assignment.save({ session });

      // Symmetric decrement, paired 1:1 with the increment in assignLicenseSeat.
      await SoftwareLicenseAsset.findByIdAndUpdate(assignment.asset, { $inc: { seatsAllocated: -1 } }, { session });
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.LICENSE_SEAT_REVOKED,
      entityType: 'Asset',
      entityId: assignment.asset.toString(),
      description: `Revoked a license seat allocation`,
      metadata,
    });

    return sanitizeAssignment(assignment);
  } finally {
    await session.endSession();
  }
};

// ---------------------------------------------------------------------------
// Reads — work uniformly across both kinds since querying the BASE model auto-hydrates
// the correct discriminator type (same behavior we already rely on for Asset).
// ---------------------------------------------------------------------------
interface ListAssignmentsQuery {
  page?: number;
  limit?: number;
  asset?: string;
  employee?: string;
  assetKind?: 'hardware' | 'software_license';
  status?: string;
}

export const listAssignments = async (query: ListAssignmentsQuery) => {
  const { page, limit } = getPaginationParams(query);
  const filter: Record<string, unknown> = {};
  if (query.asset) filter.asset = query.asset;
  if (query.employee) filter.employee = query.employee;
  if (query.assetKind) filter.assetKind = query.assetKind;
  if (query.status) filter.status = query.status;

  const [records, totalDocs] = await Promise.all([
    AssetAssignment.find(filter)
      .populate('asset', 'assetTag name category status')
      .populate('employee', 'employeeCode firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AssetAssignment.countDocuments(filter),
  ]);

  return { assignments: records.map(sanitizeAssignment), pagination: buildPaginationMeta(totalDocs, page, limit) };
};

/** Hardware: at most one. License: potentially many. Callers branch on asset kind — see asset.controller.ts. */
export const getActiveHardwareAssignment = async (assetId: string) =>
  HardwareAssignment.findOne({ asset: assetId, status: HardwareAssignmentStatus.ACTIVE }).populate(
    'employee',
    'employeeCode firstName lastName email department'
  );

export const getActiveLicenseSeats = async (assetId: string) =>
  LicenseAssignment.find({ asset: assetId, status: LicenseAssignmentStatus.ACTIVE }).populate(
    'employee',
    'employeeCode firstName lastName email department'
  );

export const getAssetAssignmentHistory = async (assetId: string) =>
  AssetAssignment.find({ asset: assetId })
    .populate('employee', 'employeeCode firstName lastName')
    .populate('assignedBy', 'name email')
    .sort({ createdAt: -1 });

/** Everything (hardware AND license) currently held by one employee — e.g. an offboarding checklist. */
export const getEmployeeActiveAssignments = async (employeeId: string) =>
  AssetAssignment.find({ employee: employeeId, status: { $in: ['active'] } }).populate(
    'asset',
    'assetTag name category status'
  );

const sanitizeAssignment = (a: any) => ({
  id: a._id.toString(),
  asset: a.asset,
  assetKind: a.assetKind,
  employee: a.employee,
  status: a.status,
  assignedDate: a.assignedDate,
  assignedBy: a.assignedBy,
  remarks: a.remarks,
  // hardware-only fields, present only when relevant — undefined keys are dropped by JSON.stringify
  expectedReturnDate: a.expectedReturnDate,
  returnedDate: a.returnedDate,
  conditionAtAssignment: a.conditionAtAssignment,
  conditionAtReturn: a.conditionAtReturn,
  returnedBy: a.returnedBy,
  returnRemarks: a.returnRemarks,
  // license-only fields
  revokedDate: a.revokedDate,
  revokedBy: a.revokedBy,
  revokeRemarks: a.revokeRemarks,
});