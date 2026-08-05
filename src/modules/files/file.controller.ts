import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import ApiError from '../../utils/ApiError';
import { storageService } from '../../shared/storage';

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file provided');
  const folder = (req.query.folder as string) || 'general';
  const result = await storageService.upload(req.file, folder);
  res.status(201).json(new ApiResponse(201, result, 'File uploaded successfully'));
});

export const deleteFile = asyncHandler(async (req: Request, res: Response) => {
  const rawFileKey = (req.query.fileKey as string) || (req.params.fileKey as string);
  if (!rawFileKey) throw ApiError.badRequest('fileKey query parameter is required');
  const fileKey = decodeURIComponent(rawFileKey);
  await storageService.delete(fileKey);
  res.status(200).json(new ApiResponse(200, null, 'File deleted successfully'));
});

export const getSignedUrl = asyncHandler(async (req: Request, res: Response) => {
  const rawFileKey     = (req.query.fileKey as string) || (req.params.fileKey as string);
  if (!rawFileKey) throw ApiError.badRequest('fileKey query parameter is required');
  const fileKey        = decodeURIComponent(rawFileKey);
  const expiresInSecs  = Math.min(86400, parseInt(req.query.expires as string) || 3600);
  const url            = await storageService.getSignedUrl(fileKey, expiresInSecs);
  res.status(200).json(new ApiResponse(200, { url, expiresInSeconds: expiresInSecs }, 'Signed URL generated'));
});
