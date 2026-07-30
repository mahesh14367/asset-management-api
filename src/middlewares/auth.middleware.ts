import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt.util';
import { User, UserRole } from '../modules/user/user.model';

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!token) {
    throw ApiError.unauthorized('Authentication token missing');
  }

  // If the token is invalid/expired, jwt.verify throws — asyncHandler
  // forwards it to globalErrorHandler, which already has JWT-specific branches.
  const payload = verifyAccessToken(token);

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User no longer exists or has been deactivated');
  }

  req.user = { id: user._id.toString(), role: user.role };
  next();
});

export const authorize =
  (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };