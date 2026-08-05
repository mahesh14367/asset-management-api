import Joi from 'joi';
import { AssetCondition } from '../asset/asset.model';

const objectId = Joi.string().trim().length(24).hex();

// Deliberately does NOT branch on asset kind the way asset.validation.ts does — Joi only
// sees the request body, not the Asset document. Whether `conditionAtAssignment` is
// required depends on looking up the referenced asset's kind, which is DB state, not
// request shape. That check lives in the service layer (assignAsset), not here.
export const createAssignmentSchema = Joi.object({
  asset: objectId.required(),
  employee: objectId.required(),
  expectedReturnDate: Joi.date().iso().greater('now'), // hardware-only; ignored server-side for licenses
  conditionAtAssignment: Joi.string().valid(...Object.values(AssetCondition)), // required for hardware — checked in service
  remarks: Joi.string().trim().max(500),
});

// Kind-specific endpoints CAN branch by Joi alone, because the endpoint itself already
// implies the kind (/return is hardware-only, /revoke is license-only).
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