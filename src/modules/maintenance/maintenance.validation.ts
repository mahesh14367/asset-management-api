import Joi from 'joi';
import { MaintenanceType, MaintenanceStatus } from './maintenance.model';

const objectId = Joi.string().trim().length(24).hex();

export const createMaintenanceSchema = Joi.object({
  asset: objectId.required(),
  type: Joi.string().valid(...Object.values(MaintenanceType)).required(),
  description: Joi.string().trim().min(5).max(1000).required(),
  vendor: Joi.string().trim().max(150),
  cost: Joi.number().min(0),
  scheduledDate: Joi.date().iso(),
});

export const completeMaintenanceSchema = Joi.object({
  resolvedNotes: Joi.string().trim().max(1000),
  cost: Joi.number().min(0),
});

export const cancelMaintenanceSchema = Joi.object({
  resolvedNotes: Joi.string().trim().max(1000),
});

export const listMaintenanceQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  asset: objectId,
  type: Joi.string().valid(...Object.values(MaintenanceType)),
  status: Joi.string().valid(...Object.values(MaintenanceStatus)),
});
