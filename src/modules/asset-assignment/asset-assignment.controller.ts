import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import * as assignmentService from './asset-assignment.service';
import { getRequestMetadata } from '../audit-log';

export const assignAsset = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentService.assignAsset(req.body, req.actor!, getRequestMetadata(req));
  res.status(201).json(new ApiResponse(201, assignment, 'Asset assigned successfully'));
});

export const returnHardwareAsset = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentService.returnHardwareAsset(
    req.params.id as string,
    req.body,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, assignment, 'Asset returned successfully'));
});

export const reportHardwareAssetLost = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentService.reportHardwareAssetLost(
    req.params.id as string,
    req.body.remarks,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, assignment, 'Asset reported lost'));
});

export const revokeLicenseSeat = asyncHandler(async (req: Request, res: Response) => {
  const assignment = await assignmentService.revokeLicenseSeat(
    req.params.id as string,
    req.body.revokeRemarks,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, assignment, 'License seat revoked successfully'));
});

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.listAssignments(req.query);
  res.status(200).json(new ApiResponse(200, result, 'Assignments fetched successfully'));
});

export const getAssetHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await assignmentService.getAssetAssignmentHistory(req.params.assetId as string);
  res.status(200).json(new ApiResponse(200, history, 'Asset assignment history fetched successfully'));
});

export const getEmployeeAssignments = asyncHandler(async (req: Request, res: Response) => {
  const assignments = await assignmentService.getEmployeeActiveAssignments(req.params.employeeId as string);
  res.status(200).json(new ApiResponse(200, assignments, 'Employee assignments fetched successfully'));
});