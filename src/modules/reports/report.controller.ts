import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import * as reportService from './report.service';
import { getRequestMetadata } from '../audit-log';

// The service writes directly to `res` (streaming) — no ApiResponse wrapper needed.
export const downloadReport = asyncHandler(async (req: Request, res: Response) => {
  await reportService.generateReport(
    req.query as unknown as reportService.GenerateReportParams,
    req.actor!,
    getRequestMetadata(req),
    res
  );
});
