import mongoose from 'mongoose';
import { Maintenance, MaintenanceType, MaintenanceStatus, IMaintenance } from './maintenance.model';
import { Asset, AssetStatus, AssetCondition } from '../asset/asset.model';
import { IUser } from '../user/user.model';
import ApiError from '../../utils/ApiError';
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination.util';
import { createAuditLog, buildActorSnapshot, AuditAction } from '../audit-log';
import { AuditMetadata } from '../audit-log/audit-log.model';

type Actor = Pick<IUser, '_id' | 'name' | 'email' | 'role'>;

// Maps maintenance type to the asset status it sets on the asset when opened.
const TYPE_TO_ASSET_STATUS: Record<MaintenanceType, AssetStatus> = {
  [MaintenanceType.MAINTENANCE]: AssetStatus.UNDER_MAINTENANCE,
  [MaintenanceType.REPAIR]: AssetStatus.IN_REPAIR,
};

interface OpenMaintenanceInput {
  asset: string;
  type: MaintenanceType;
  description: string;
  vendor?: string;
  cost?: number;
  scheduledDate?: Date;
}

interface CloseMaintenanceInput {
  resolvedNotes?: string;
  cost?: number;
}

const sanitizeMaintenance = (record: IMaintenance) => ({
  id: record._id.toString(),
  asset: record.asset,
  type: record.type,
  status: record.status,
  description: record.description,
  vendor: record.vendor,
  cost: record.cost,
  scheduledDate: record.scheduledDate,
  startedDate: record.startedDate,
  completedDate: record.completedDate,
  resolvedNotes: record.resolvedNotes,
  createdBy: record.createdBy,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const openMaintenance = async (
  input: OpenMaintenanceInput,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const asset = await Asset.findById(input.asset);
  if (!asset) throw ApiError.notFound('Asset not found');
  if (asset.assetKind !== 'hardware') {
    throw ApiError.badRequest('Maintenance records can only be created for hardware assets');
  }
  if (asset.status !== AssetStatus.AVAILABLE) {
    throw ApiError.badRequest(
      `Asset is currently '${asset.status}' and cannot be placed into maintenance. Only available assets can be scheduled.`
    );
  }

  const targetStatus = TYPE_TO_ASSET_STATUS[input.type];
  const session = await mongoose.startSession();
  try {
    let record!: IMaintenance;

    await session.withTransaction(async () => {
      const [created] = await Maintenance.create(
        [
          {
            asset: asset._id,
            type: input.type,
            description: input.description,
            vendor: input.vendor,
            cost: input.cost,
            scheduledDate: input.scheduledDate,
            startedDate: new Date(),
            createdBy: actor._id,
          },
        ],
        { session }
      );
      record = created;

      await Asset.findByIdAndUpdate(asset._id, { status: targetStatus }, { session });
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.MAINTENANCE_STARTED,
      entityType: 'Asset',
      entityId: asset._id.toString(),
      description: `Opened ${input.type} record for ${asset.assetTag} (${asset.name})`,
      metadata,
    });

    return sanitizeMaintenance(record);
  } catch (err: any) {
    if (err.code === 11000) {
      throw ApiError.conflict('This asset already has an open maintenance record');
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

export const completeMaintenance = async (
  id: string,
  input: CloseMaintenanceInput,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const record = await Maintenance.findById(id);
  if (!record) throw ApiError.notFound('Maintenance record not found');
  if (record.status !== MaintenanceStatus.OPEN) {
    throw ApiError.badRequest(`Cannot complete a maintenance record that is already '${record.status}'`);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      record.status = MaintenanceStatus.COMPLETED;
      record.completedDate = new Date();
      if (input.resolvedNotes !== undefined) record.resolvedNotes = input.resolvedNotes;
      if (input.cost !== undefined) record.cost = input.cost;
      await record.save({ session });

      await Asset.findByIdAndUpdate(record.asset, { status: AssetStatus.AVAILABLE }, { session });
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.MAINTENANCE_COMPLETED,
      entityType: 'Asset',
      entityId: record.asset.toString(),
      description: `Completed ${record.type} record for asset ${record.asset}`,
      metadata,
    });

    return sanitizeMaintenance(record);
  } finally {
    await session.endSession();
  }
};

export const cancelMaintenance = async (
  id: string,
  input: CloseMaintenanceInput,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const record = await Maintenance.findById(id);
  if (!record) throw ApiError.notFound('Maintenance record not found');
  if (record.status !== MaintenanceStatus.OPEN) {
    throw ApiError.badRequest(`Cannot cancel a maintenance record that is already '${record.status}'`);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      record.status = MaintenanceStatus.CANCELLED;
      record.completedDate = new Date();
      if (input.resolvedNotes !== undefined) record.resolvedNotes = input.resolvedNotes;
      await record.save({ session });

      await Asset.findByIdAndUpdate(record.asset, { status: AssetStatus.AVAILABLE }, { session });
    });

    await createAuditLog({
      actor: buildActorSnapshot(actor),
      action: AuditAction.MAINTENANCE_CANCELLED,
      entityType: 'Asset',
      entityId: record.asset.toString(),
      description: `Cancelled ${record.type} record for asset ${record.asset}`,
      metadata,
    });

    return sanitizeMaintenance(record);
  } finally {
    await session.endSession();
  }
};

export const getMaintenanceById = async (id: string) => {
  const record = await Maintenance.findById(id).populate('asset', 'assetTag name category assetKind');
  if (!record) throw ApiError.notFound('Maintenance record not found');
  return record;
};

export const listMaintenance = async (query: {
  page?: number;
  limit?: number;
  asset?: string;
  type?: string;
  status?: string;
}) => {
  const { page, limit } = getPaginationParams(query);
  const filter: Record<string, unknown> = {};
  if (query.asset) filter.asset = query.asset;
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;

  const [records, total] = await Promise.all([
    Maintenance.find(filter)
      .populate('asset', 'assetTag name category assetKind')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Maintenance.countDocuments(filter),
  ]);

  return { records, meta: buildPaginationMeta(total, page, limit) };
};

export const getAssetMaintenanceHistory = async (assetId: string) => {
  const asset = await Asset.findById(assetId);
  if (!asset) throw ApiError.notFound('Asset not found');

  const records = await Maintenance.find({ asset: assetId })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email');

  return records;
};
