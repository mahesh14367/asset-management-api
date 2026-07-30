import { Request } from 'express';
import { Types } from 'mongoose';
import {
  AuditLog,
  AuditAction,
  AuditStatus,
  AuditActor,
  AuditChanges,
  AuditMetadata,
} from './audit-log.model';
import { IUser } from '../user/user.model';
import { logger } from '../../config/logger';
import { getPaginationParams, buildPaginationMeta } from '../../utils/pagination.util';

interface CreateAuditLogInput {
  actor: AuditActor;
  action: AuditAction;
  status?: AuditStatus;
  entityType: string;
  entityId?: Types.ObjectId;
  description: string;
  changes?: AuditChanges;
  metadata?: AuditMetadata;
}

/** Snapshot an actor's identity at the moment of the action — see rationale above. */
export const buildActorSnapshot = (user: Pick<IUser, '_id' | 'name' | 'email' | 'role'>): AuditActor => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

/** Pulls IP + user-agent from the request so callers don't repeat this everywhere. */
export const getRequestMetadata = (req: Request): AuditMetadata => {
  const metadata: AuditMetadata = {};
  if (req.ip) metadata.ipAddress = req.ip;
  const userAgent = req.headers['user-agent'];
  if (typeof userAgent === 'string') {
    metadata.userAgent = userAgent;
  } else if (Array.isArray(userAgent) && userAgent[0]) {
    metadata.userAgent = userAgent[0];
  }
  return metadata;
};

/**
 * Writes an audit log entry. Deliberately NEVER throws — a failure to persist
 * an audit record must never break the user-facing operation it describes.
 * On failure it logs the failure itself via Winston so it's still visible to ops.
 */
export const createAuditLog = async (input: CreateAuditLogInput): Promise<void> => {
  try {
    const createData: Record<string, unknown> = {
      actor: input.actor,
      action: input.action,
      status: input.status ?? AuditStatus.SUCCESS,
      entityType: input.entityType,
      description: input.description,
      metadata: input.metadata ?? {},
    };
    if (input.entityId) createData.entityId = input.entityId;
    if (input.changes) createData.changes = input.changes;

    await AuditLog.create(createData);
  } catch (error) {
    logger.error('Failed to write audit log entry', {
      error,
      action: input.action,
      entityType: input.entityType,
    });
  }
};

interface ListAuditLogsQuery {
  page?: number;
  limit?: number;
  action?: AuditAction;
  entityType?: string;
  entityId?: Types.ObjectId;
  actorId?: string;
  status?: AuditStatus;
  dateFrom?: string;
  dateTo?: string;
}

export const listAuditLogs = async (query: ListAuditLogsQuery) => {
  const { page, limit } = getPaginationParams(query);

  const filter: Record<string, unknown> = {};
  if (query.action) filter.action = query.action;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.actorId) filter['actor.id'] = query.actorId;
  if (query.status) filter.status = query.status;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {
      ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}),
    };
  }

  const [logs, totalDocs] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, pagination: buildPaginationMeta(totalDocs, page, limit) };
};

/** Convenience: full chronological history for one specific entity (e.g. one user, one asset). */
export const getEntityHistory = async (entityType: string, entityId: Types.ObjectId) => {
  return AuditLog.find({ entityType, entityId }).sort({ createdAt: -1 });
};