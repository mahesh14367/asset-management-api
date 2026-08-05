import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import * as maintenanceService from './maintenance.service';
import { getRequestMetadata } from '../audit-log';

export const openMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const record = await maintenanceService.openMaintenance(req.body, req.actor!, getRequestMetadata(req));
  res.status(201).json(new ApiResponse(201, record, 'Maintenance record opened successfully'));
});

export const completeMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const record = await maintenanceService.completeMaintenance(
    req.params.id as string,
    req.body,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, record, 'Maintenance record completed'));
});

export const cancelMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const record = await maintenanceService.cancelMaintenance(
    req.params.id as string,
    req.body,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, record, 'Maintenance record cancelled'));
});

export const getMaintenanceById = asyncHandler(async (req: Request, res: Response) => {
  const record = await maintenanceService.getMaintenanceById(req.params.id as string);
  res.status(200).json(new ApiResponse(200, record, 'Maintenance record fetched successfully'));
});

export const listMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const result = await maintenanceService.listMaintenance(req.query);
  res.status(200).json(new ApiResponse(200, result, 'Maintenance records fetched successfully'));
});

export const getAssetMaintenanceHistory = asyncHandler(async (req: Request, res: Response) => {
  const records = await maintenanceService.getAssetMaintenanceHistory(req.params.assetId as string);
  res.status(200).json(new ApiResponse(200, records, 'Asset maintenance history fetched successfully'));
});
