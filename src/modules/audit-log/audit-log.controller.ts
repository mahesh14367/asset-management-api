import { Request, Response } from 'express';
import { Types } from 'mongoose';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import * as auditLogService from './audit-log.service';

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditLogService.listAuditLogs(req.query);
  res.status(200).json(new ApiResponse(200, result, 'Audit logs fetched successfully'));
});

export const getEntityHistory = asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params as { entityType: string; entityId: string };
  const logs = await auditLogService.getEntityHistory(entityType, new Types.ObjectId(entityId));
  res.status(200).json(new ApiResponse(200, logs, 'Entity history fetched successfully'));
});