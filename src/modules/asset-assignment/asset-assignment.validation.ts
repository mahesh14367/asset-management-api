import Joi from 'joi';
import { AssetCondition } from '../asset/asset.model';

const objectId = Joi.string().trim().length(24).hex();

// These fields are optional at validation level - the service layer enforces them
// specifically for hardware assets based on the asset's kind in the database
export const createAssignmentSchema = Joi.object({
  asset: objectId.required(),
  employee: objectId.required(),
  expectedReturnDate: Joi.date().iso().greater('now').optional(), // hardware-only
  conditionAtAssignment: Joi.string().valid(...Object.values(AssetCondition)).optional(), // required for hardware, enforced in service
  remarks: Joi.string().trim().max(500).optional(),
});

// Kind-specific endpoints CAN branch by Joi alone, because the endpoint itself implies the kind
// (/return is hardware-only, /revoke is license-only).
export const returnAssignmentSchema = Joi.object({
  conditionAtReturn: Joi.string().valid(...Object.values(AssetCondition)).required(),
  returnRemarks: Joi.string().trim().max(500),
});

export const reportLostSchema = Joi.object({
  remarks: Joi.string().trim().max(500),
});

export const revokeSeatSchema = Joi.object({
  revokeRemarks: Joi.string().trim().max(500),
});

export const listAssignmentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  asset: objectId,
  employee: objectId,
  assetKind: Joi.string().valid('hardware', 'software_license'),
  status: Joi.string().valid('active', 'returned', 'lost', 'revoked'),
});