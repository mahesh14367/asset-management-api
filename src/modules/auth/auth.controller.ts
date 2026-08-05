import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import ApiError from '../../utils/ApiError';
import * as authService from './auth.service';
import { config } from '../../config';


const REFRESH_COOKIE_NAME = 'refreshToken';

const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: config.jwt.refreshCookieMaxAgeMs,
  path: '/api/v1/auth', // narrow scope — cookie only sent to auth endpoints
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
  res.status(200).json(new ApiResponse(200, { user, accessToken }, 'Logged in successfully'));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!incomingToken) {
    throw ApiError.unauthorized('Refresh token missing, please log in again');
  }

  const { accessToken, refreshToken } = await authService.refreshAccessToken(incomingToken);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
  res.status(200).json(new ApiResponse(200, { accessToken }, 'Token refreshed successfully'));
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logout(req.user.id);
  }
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
  res.status(200).json(new ApiResponse(200, null, 'Logged out successfully'));
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.status(200).json(new ApiResponse(200, user, 'Current user fetched successfully'));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body);
  res.status(200).json(new ApiResponse(200, result, 'Password reset email sent'));
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.resetPassword(req.body);
  res.status(200).json(new ApiResponse(200, result, 'Password reset successfully'));
});

