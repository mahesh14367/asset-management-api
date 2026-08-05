import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import * as assetService from './asset.service';
import * as assignmentService from '../asset-assignment/asset-assignment.service';
import { getRequestMetadata } from '../audit-log';


export const createAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.createAsset(req.body, req.actor!, getRequestMetadata(req));
  res.status(201).json(new ApiResponse(201, asset, 'Asset created successfully'));
});

export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const result = await assetService.listAssets(req.query);
  res.status(200).json(new ApiResponse(200, result, 'Assets fetched successfully'));
});


export const getAsset = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const asset = await assetService.getAssetById(id);

  const extra =
    asset.assetKind === 'hardware'
      ? { currentAssignment: await assignmentService.getActiveHardwareAssignment(id) }
      : { activeSeats: await assignmentService.getActiveLicenseSeats(id) };

  res.status(200).json(new ApiResponse(200, { ...asset, ...extra }, 'Asset fetched successfully'));
});

export const updateAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.updateAsset(req.params.id as string, req.body, req.actor!, getRequestMetadata(req));
  res.status(200).json(new ApiResponse(200, asset, 'Asset updated successfully'));
});

export const updateAssetStatus = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.updateAssetStatus(
    req.params.id as string,
    req.body.status,
    req.body.reason,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, asset, 'Asset status updated successfully'));
});