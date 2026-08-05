import Joi from 'joi';
import { AssetCategory, AssetCondition } from './asset.model';

const HARDWARE_CATEGORIES = [
  AssetCategory.LAPTOP,
  AssetCategory.DESKTOP,
  AssetCategory.SERVER,
  AssetCategory.NETWORKING_DEVICE,
  AssetCategory.MOBILE_DEVICE,
  AssetCategory.PRINTER,
  AssetCategory.ACCESSORY,
];

// Mirrors the discriminator split at the validation layer: hardware-only fields are
// FORBIDDEN (not just optional) for a license, and vice versa — Joi rejects the request
// outright if someone sends a serialNumber for a software_license, rather than silently
// ignoring it. That silent-ignore behavior is itself a subtle redundancy/ambiguity trap.
export const createAssetSchema = Joi.object({
  category: Joi.string().valid(...Object.values(AssetCategory)).required(),
  name: Joi.string().trim().min(2).max(150).required(),
  brand: Joi.string().trim().max(100),
  modelName: Joi.string().trim().max(100),
  vendor: Joi.string().trim().max(150),
  purchaseDate: Joi.date().iso().max('now'),
  purchasePrice: Joi.number().min(0),
  warrantyExpiryDate: Joi.date().iso(),
  location: Joi.string().trim().max(150),
  notes: Joi.string().trim().max(1000),

  serialNumber: Joi.string().trim().when('category', {
    is: Joi.valid(...HARDWARE_CATEGORIES),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  condition: Joi.string().valid(...Object.values(AssetCondition)).when('category', {
    is: Joi.valid(...HARDWARE_CATEGORIES),
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  specifications: Joi.object().pattern(Joi.string(), Joi.string()).when('category', {
    is: Joi.valid(...HARDWARE_CATEGORIES),
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),

  licenseKey: Joi.string().trim().when('category', {
    is: AssetCategory.SOFTWARE_LICENSE,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  totalSeats: Joi.number().integer().min(1).when('category', {
    is: AssetCategory.SOFTWARE_LICENSE,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  expiryDate: Joi.date().iso().when('category', {
    is: AssetCategory.SOFTWARE_LICENSE,
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
});

// `category` and `assetTag` are immutable — Mongoose's `immutable: true` guards this at
// the schema level too, but excluding it here means it's not even a valid field to send.
export const updateAssetSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  brand: Joi.string().trim().max(100),
  modelName: Joi.string().trim().max(100),
  vendor: Joi.string().trim().max(150),
  purchaseDate: Joi.date().iso().max('now'),
  purchasePrice: Joi.number().min(0),
  warrantyExpiryDate: Joi.date().iso(),
  location: Joi.string().trim().max(150),
  notes: Joi.string().trim().max(1000),
  condition: Joi.string().valid(...Object.values(AssetCondition)),
  specifications: Joi.object().pattern(Joi.string(), Joi.string()),
}).min(1);

// `available`/`assigned` handled below — ASSIGNED is excluded entirely: only reachable
// via the Asset Assignment module.
export const updateAssetStatusSchema = Joi.object({
  status: Joi.string()
    .valid('available', 'under_maintenance', 'in_repair', 'retired', 'disposed', 'lost')
    .required(),
  reason: Joi.string().trim().max(500),
});

export const listAssetsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  category: Joi.string().valid(...Object.values(AssetCategory)),
  status: Joi.string().valid('available', 'assigned', 'under_maintenance', 'in_repair', 'retired', 'disposed', 'lost'),
  search: Joi.string().trim().max(100),
});