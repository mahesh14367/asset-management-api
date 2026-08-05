import {
  Asset,
  HardwareAsset,
  SoftwareLicenseAsset,
  AssetCategory,
  AssetStatus,
  ASSET_STATUS_TRANSITIONS,
  IAsset,
  IHardwareAsset,
  ISoftwareLicenseAsset,
} from './asset.model';
import { IUser } from '../user/user.model';
import ApiError from '../../utils/ApiError';
import { getNextSequence } from '../../utils/counter.util';
import { getPaginationParams, buildPaginationMeta, escapeRegex } from '../../utils/pagination.util';
import { createAuditLog, buildActorSnapshot, AuditAction } from '../audit-log';
import { AuditMetadata } from '../audit-log/audit-log.model';

type Actor = Pick<IUser, '_id' | 'name' | 'email' | 'role'>;

const HARDWARE_CATEGORIES = new Set([
  AssetCategory.LAPTOP,
  AssetCategory.DESKTOP,
  AssetCategory.SERVER,
  AssetCategory.NETWORKING_DEVICE,
  AssetCategory.MOBILE_DEVICE,
  AssetCategory.PRINTER,
  AssetCategory.ACCESSORY,
]);

const ASSET_TAG_PREFIX: Record<AssetCategory, string> = {
  [AssetCategory.LAPTOP]: 'LAP',
  [AssetCategory.DESKTOP]: 'DSK',
  [AssetCategory.SERVER]: 'SRV',
  [AssetCategory.NETWORKING_DEVICE]: 'NET',
  [AssetCategory.MOBILE_DEVICE]: 'MOB',
  [AssetCategory.PRINTER]: 'PRN',
  [AssetCategory.ACCESSORY]: 'ACC',
  [AssetCategory.SOFTWARE_LICENSE]: 'LIC',
};

const sanitizeAsset = (asset: IAsset) => {
  const base = {
    id: asset._id.toString(),
    assetTag: asset.assetTag,
    assetKind: asset.assetKind,
    category: asset.category,
    name: asset.name,
    brand: asset.brand,
    modelName: asset.modelName,
    status: asset.status,
    vendor: asset.vendor,
    purchaseDate: asset.purchaseDate,
    purchasePrice: asset.purchasePrice,
    warrantyExpiryDate: asset.warrantyExpiryDate,
    location: asset.location,
    notes: asset.notes,
    createdAt: asset.createdAt,
  };

  if (asset.assetKind === 'hardware') {
    const hw = asset as IHardwareAsset;
    return {
      ...base,
      serialNumber: hw.serialNumber,
      condition: hw.condition,
      specifications: hw.specifications ? Object.fromEntries(hw.specifications) : undefined,
    };
  }

  const lic = asset as ISoftwareLicenseAsset;
  // licenseKey deliberately excluded — this function is the single allow-list that
  // decides what leaves the API, same pattern as User's sanitizeUser omitting password.
  return {
  ...base,
  totalSeats: lic.totalSeats,
  seatsAllocated: lic.seatsAllocated,
  seatsAvailable: lic.totalSeats - lic.seatsAllocated,
  expiryDate: lic.expiryDate,
};
};

interface CreateAssetInput {
  category: AssetCategory;
  name: string;
  brand?: string;
  modelName?: string;
  vendor?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiryDate?: Date;
  location?: string;
  notes?: string;
  serialNumber?: string;
  condition?: string;
  specifications?: Record<string, string>;
  licenseKey?: string;
  totalSeats?: number;
  expiryDate?: Date;
}

export const createAsset = async (input: CreateAssetInput, actor: Actor, metadata: AuditMetadata) => {
  const isHardware = HARDWARE_CATEGORIES.has(input.category);

  if (isHardware) {
    const existing = await HardwareAsset.findOne({ serialNumber: input.serialNumber });
    if (existing) throw ApiError.conflict('An asset with this serial number already exists');
  }

  const prefix = ASSET_TAG_PREFIX[input.category];
  const seq = await getNextSequence(`assetTag:${prefix}`);
  const assetTag = `${prefix}-${String(seq).padStart(5, '0')}`;

  const Model = isHardware ? HardwareAsset : SoftwareLicenseAsset;
  const asset = await Model.create({ ...input, assetTag });

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.ASSET_CREATED,
    entityType: 'Asset',
    entityId: asset._id.toString(),
    description: `Created asset ${asset.assetTag} (${asset.name})`,
    metadata,
  });

  return sanitizeAsset(asset);
};

interface ListAssetsQuery {
  page?: number;
  limit?: number;
  category?: AssetCategory;
  status?: AssetStatus;
  search?: string;
}

export const listAssets = async (query: ListAssetsQuery) => {
  const { page, limit } = getPaginationParams(query);
  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const safe = escapeRegex(query.search);
    filter.$or = [
      { assetTag: { $regex: safe, $options: 'i' } },
      { name: { $regex: safe, $options: 'i' } },
      { brand: { $regex: safe, $options: 'i' } },
      { modelName: { $regex: safe, $options: 'i' } },
      { serialNumber: { $regex: safe, $options: 'i' } },
    ];
  }

  // Querying via the base `Asset` model still returns properly-typed HardwareAsset /
  // SoftwareLicenseAsset instances — Mongoose auto-hydrates using the stored `assetKind`.
  const [assets, totalDocs] = await Promise.all([
    Asset.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Asset.countDocuments(filter),
  ]);

  return { assets: assets.map(sanitizeAsset), pagination: buildPaginationMeta(totalDocs, page, limit) };
};

export const getAssetById = async (id: string) => {
  const asset = await Asset.findById(id);
  if (!asset) throw ApiError.notFound('Asset not found');
  return sanitizeAsset(asset);
};

interface UpdateAssetInput {
  name?: string;
  brand?: string;
  modelName?: string;
  vendor?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiryDate?: Date;
  location?: string;
  notes?: string;
  condition?: string;
  specifications?: Record<string, string>;
}

export const updateAsset = async (id: string, input: UpdateAssetInput, actor: Actor, metadata: AuditMetadata) => {
  const asset = await Asset.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!asset) throw ApiError.notFound('Asset not found');

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.ASSET_UPDATED,
    entityType: 'Asset',
    entityId: id,
    description: `Updated asset ${asset.assetTag}'s details`,
    changes: { after: input as Record<string, unknown> },
    metadata,
  });

  return sanitizeAsset(asset);
};

export const updateAssetStatus = async (
  id: string,
  newStatus: AssetStatus,
  reason: string | undefined,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const asset = await Asset.findById(id);
  if (!asset) throw ApiError.notFound('Asset not found');

  if (newStatus === AssetStatus.ASSIGNED) {
    throw ApiError.badRequest('Use the Asset Assignment module to assign this asset');
  }
  // Any transition OUT of ASSIGNED (return, or "reported lost while assigned") must go
  // through the Asset Assignment module — it's the only place that also closes out the
  // active assignment record. Blocking it here prevents an asset ending up AVAILABLE
  // while an AssetAssignment record still claims it's ACTIVE.
  if (asset.status === AssetStatus.ASSIGNED) {
    throw ApiError.badRequest(
      'This asset is currently assigned. Use the Asset Assignment module to return it or report it lost.'
    );
  }

  const allowedNext = ASSET_STATUS_TRANSITIONS[asset.status];
  if (!allowedNext.includes(newStatus)) {
    throw ApiError.badRequest(`Cannot transition asset from '${asset.status}' to '${newStatus}'`);
  }

  const previousStatus = asset.status;
  asset.status = newStatus;
  await asset.save();

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.ASSET_STATUS_CHANGED,
    entityType: 'Asset',
    entityId: id,
    description: `${asset.assetTag} status changed from ${previousStatus} to ${newStatus}${reason ? ` — ${reason}` : ''}`,
    changes: { before: { status: previousStatus }, after: { status: newStatus } },
    metadata,
  });

  return sanitizeAsset(asset);
};