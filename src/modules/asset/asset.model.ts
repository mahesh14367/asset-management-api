import mongoose, { Schema, model, Model, Document, Types } from 'mongoose';
import { getOrCreateDiscriminator } from '../../utils/model.util';

export enum AssetCategory {
  LAPTOP = 'laptop',
  DESKTOP = 'desktop',
  SERVER = 'server',
  NETWORKING_DEVICE = 'networking_device',
  MOBILE_DEVICE = 'mobile_device',
  PRINTER = 'printer',
  ACCESSORY = 'accessory',
  SOFTWARE_LICENSE = 'software_license',
}

export enum AssetStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  UNDER_MAINTENANCE = 'under_maintenance',
  IN_REPAIR = 'in_repair',
  RETIRED = 'retired',
  DISPOSED = 'disposed',
  LOST = 'lost',
}

export enum AssetCondition {
  NEW = 'new',
  GOOD = 'good',
  FAIR = 'fair',
  DAMAGED = 'damaged',
}

// The asset lifecycle state machine — defined next to the schema it governs.
// `ASSIGNED` deliberately only reachable/leavable via specific paths (see comments below);
// everything else is a normal admin-driven transition, enforced in the service layer.
export const ASSET_STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  [AssetStatus.AVAILABLE]: [
    AssetStatus.ASSIGNED,
    AssetStatus.UNDER_MAINTENANCE,
    AssetStatus.IN_REPAIR,
    AssetStatus.RETIRED,
    AssetStatus.LOST,
  ],
  [AssetStatus.ASSIGNED]: [AssetStatus.AVAILABLE, AssetStatus.LOST], // only via the Asset Assignment module — see asset.service.ts
  [AssetStatus.UNDER_MAINTENANCE]: [AssetStatus.AVAILABLE, AssetStatus.IN_REPAIR, AssetStatus.RETIRED],
  [AssetStatus.IN_REPAIR]: [AssetStatus.AVAILABLE, AssetStatus.UNDER_MAINTENANCE, AssetStatus.RETIRED, AssetStatus.DISPOSED],
  [AssetStatus.RETIRED]: [AssetStatus.DISPOSED],
  [AssetStatus.DISPOSED]: [], // terminal
  [AssetStatus.LOST]: [AssetStatus.AVAILABLE, AssetStatus.DISPOSED], // "found" → back in circulation, or written off
};

export interface IAsset extends Document {
  id: Types.ObjectId;
  assetTag: string;
  assetKind: 'hardware' | 'software_license';
  category: AssetCategory;
  name: string;
  brand?: string;
  modelName?: string;
  status: AssetStatus;
  vendor?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiryDate?: Date;
  location?: string;
  notes?: string;
  attachments: { fileKey: string; url: string; originalName: string; mimeType: string; size: number; uploadedAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

// discriminatorKey stores which "subtype" each document is — Mongoose uses it to
// auto-hydrate documents with the right schema even when queried via the base model.
const options = { discriminatorKey: 'assetKind', timestamps: true };

const assetSchema = new Schema<IAsset>(
  {
    assetTag: { type: String, required: true, unique: true, immutable: true },
    category: { type: String, enum: Object.values(AssetCategory), required: true, immutable: true },
    name: { type: String, required: [true, 'Asset name is required'], trim: true, maxlength: 150 },
    brand: { type: String, trim: true },
    modelName: { type: String, trim: true },
    status: { type: String, enum: Object.values(AssetStatus), default: AssetStatus.AVAILABLE },
    // Free text for now — same trade-off as Employee.department: normalizing into a
    // `Vendor` collection is a clean future step once contract/support tracking matters.
    vendor: { type: String, trim: true },
    purchaseDate: { type: Date },
    purchasePrice: { type: Number, min: 0 },
    warrantyExpiryDate: { type: Date },
    location: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    attachments: [
      {
        fileKey:      { type: String, required: true },
        url:          { type: String, required: true },
        originalName: { type: String, required: true },
        mimeType:     { type: String, required: true },
        size:         { type: Number, required: true },
        uploadedAt:   { type: Date,   default: Date.now },
      },
    ],
  },
  options
);

assetSchema.index({ category: 1, status: 1 });
assetSchema.index({ status: 1 });

export const Asset = (mongoose.models.Asset as Model<IAsset>) ?? model<IAsset>('Asset', assetSchema);

// ---------------------------------------------------------------------------
// Discriminator: HardwareAsset
// Covers laptop / desktop / server / networking_device / mobile_device / printer / accessory —
// one discriminator, not seven, because they share the same STRUCTURE and only differ in
// what goes inside `specifications`.
// ---------------------------------------------------------------------------
export interface IHardwareAsset extends IAsset {
  serialNumber: string;
  condition: AssetCondition;
  specifications?: Map<string, string>;
}

const hardwareSchema = new Schema<IHardwareAsset>({
  serialNumber: { type: String, required: [true, 'Serial number is required'], unique: true, trim: true },
  condition: { type: String, enum: Object.values(AssetCondition), default: AssetCondition.NEW },
  // Flat key-value bag (laptop → {ram, cpu, storage}; printer → {type, pagesPerMinute}) —
  // Map<string,string>, not a Mixed blob, so it stays self-documenting and queryable.
  specifications: { type: Map, of: String },
});

export const HardwareAsset = getOrCreateDiscriminator<IHardwareAsset>(Asset, 'HardwareAsset', hardwareSchema, 'hardware');


// ---------------------------------------------------------------------------
// Discriminator: SoftwareLicenseAsset
// Structurally different — no serial number, no physical condition, no location.
// Putting these on the base schema would mean every hardware doc carries 3 permanently-
// null license fields. That IS redundancy. The discriminator split eliminates it.
// ---------------------------------------------------------------------------
export interface ISoftwareLicenseAsset extends IAsset {
  licenseKey: string;
  totalSeats: number;
  seatsAllocated: number;
  expiryDate?: Date;
}

const softwareLicenseSchema = new Schema<ISoftwareLicenseAsset>({
  licenseKey: { type: String, required: true, select: false }, // sensitive — never returned by default
  totalSeats: { type: Number, required: true, min: 1 },
  seatsAllocated: { type: Number, default: 0, min: 0 },
  expiryDate: { type: Date },
});

export const SoftwareLicenseAsset = getOrCreateDiscriminator<ISoftwareLicenseAsset>(Asset, 'SoftwareLicenseAsset', softwareLicenseSchema, 'software_license');