import mongoose, { Schema, model, Model, Document, Types } from 'mongoose';
import { AssetCondition } from '../asset/asset.model';
import { getOrCreateDiscriminator } from '../../utils/model.util';

// ---------------------------------------------------------------------------
// Base schema — shared by BOTH hardware and license assignments.
// Deliberately holds only what's true for every kind of "possession/usage" record:
// which asset, which employee, when, and who authorized it.
// ---------------------------------------------------------------------------
export interface IAssetAssignment extends Document {
  _id: Types.ObjectId;
  asset: Types.ObjectId;
  assetKind: 'hardware' | 'software_license'; // discriminator key — set automatically, never client-supplied
  employee: Types.ObjectId;
  assignedDate: Date;
  assignedBy: Types.ObjectId;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const options = { discriminatorKey: 'assetKind', timestamps: true };

const baseSchema = new Schema<IAssetAssignment>(
  {
    asset: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    assignedDate: { type: Date, required: true, default: Date.now },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    remarks: { type: String, trim: true, maxlength: 500 },
  },
  options
);

baseSchema.index({ employee: 1 });
baseSchema.index({ asset: 1, createdAt: -1 }); // full history for one asset, either kind

export const AssetAssignment = (mongoose.models.AssetAssignment as Model<IAssetAssignment>) ?? model<IAssetAssignment>('AssetAssignment', baseSchema);

// ---------------------------------------------------------------------------
// Discriminator: HardwareAssignment — one holder at a time, physical condition tracking.
// ---------------------------------------------------------------------------
export enum HardwareAssignmentStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  LOST = 'lost',
}

export interface IHardwareAssignment extends IAssetAssignment {
  status: HardwareAssignmentStatus;
  expectedReturnDate?: Date;
  returnedDate?: Date;
  conditionAtAssignment: AssetCondition;
  conditionAtReturn?: AssetCondition;
  returnedBy?: Types.ObjectId;
  returnRemarks?: string;
}

const hardwareAssignmentSchema = new Schema<IHardwareAssignment>({
  status: { type: String, enum: Object.values(HardwareAssignmentStatus), default: HardwareAssignmentStatus.ACTIVE },
  expectedReturnDate: { type: Date },
  returnedDate: { type: Date },
  conditionAtAssignment: { type: String, enum: Object.values(AssetCondition), required: true },
  conditionAtReturn: { type: String, enum: Object.values(AssetCondition) },
  returnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  returnRemarks: { type: String, trim: true, maxlength: 500 },
});

// THE integrity guarantee for hardware: impossible to have 2 ACTIVE records for the same
// asset. `assetKind: 'hardware'` in the filter is what scopes this index to ONLY hardware
// documents in the shared collection — license documents are invisible to this index.
hardwareAssignmentSchema.index(
  { asset: 1 },
  { unique: true, partialFilterExpression: { status: HardwareAssignmentStatus.ACTIVE, assetKind: 'hardware' } }
);

export const HardwareAssignment = getOrCreateDiscriminator<IHardwareAssignment>(AssetAssignment, 'HardwareAssignment', hardwareAssignmentSchema, 'hardware');



// ---------------------------------------------------------------------------
// Discriminator: LicenseAssignment — many concurrent holders, capacity-gated.
// ---------------------------------------------------------------------------
export enum LicenseAssignmentStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

export interface ILicenseAssignment extends IAssetAssignment {
  status: LicenseAssignmentStatus;
  revokedDate?: Date;
  revokedBy?: Types.ObjectId;
  revokeRemarks?: string;
}

const licenseAssignmentSchema = new Schema<ILicenseAssignment>({
  status: { type: String, enum: Object.values(LicenseAssignmentStatus), default: LicenseAssignmentStatus.ACTIVE },
  revokedDate: { type: Date },
  revokedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  revokeRemarks: { type: String, trim: true, maxlength: 500 },
});

// Different shape of guarantee: NOT "one holder total" — "this specific employee can't
// hold two simultaneous active seats on this specific license" (retried/double-click safe).
// Actual capacity (seatsAllocated < totalSeats) is enforced separately, atomically,
// against SoftwareLicenseAsset itself — see assignLicenseSeat() below.
licenseAssignmentSchema.index(
  { asset: 1, employee: 1 },
  { unique: true, partialFilterExpression: { status: LicenseAssignmentStatus.ACTIVE, assetKind: 'software_license' } }
);

export const LicenseAssignment = getOrCreateDiscriminator<ILicenseAssignment>(AssetAssignment, 'LicenseAssignment', licenseAssignmentSchema, 'software_license');