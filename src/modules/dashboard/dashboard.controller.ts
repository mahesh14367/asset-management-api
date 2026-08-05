import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import * as dashboardService from './dashboard.service';

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  const data = await dashboardService.getStats();
  res.status(200).json(new ApiResponse(200, data, 'Dashboard stats fetched successfully'));
});

export const getCharts = asyncHandler(async (req: Request, res: Response) => {
  const months = Math.min(12, Math.max(1, Number(req.query.months) || 6));
  const data = await dashboardService.getCharts(months);
  res.status(200).json(new ApiResponse(200, data, 'Dashboard charts fetched successfully'));
});

export const getKPIs = asyncHandler(async (_req: Request, res: Response) => {
  const data = await dashboardService.getKPIs();
  res.status(200).json(new ApiResponse(200, data, 'Dashboard KPIs fetched successfully'));
});
