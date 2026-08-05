import Joi from 'joi';
import { AuditAction, AuditStatus } from './audit-log.model';

export const listAuditLogsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  action: Joi.string().valid(...Object.values(AuditAction)),
  entityType: Joi.string().trim(),
  entityId: Joi.string().trim().length(24).hex(),
  actorId: Joi.string().trim().length(24).hex(),
  status: Joi.string().valid(...Object.values(AuditStatus)),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
});