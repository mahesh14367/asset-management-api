import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import * as userService from './user.service';
import { User } from './user.model';
import { getRequestMetadata } from '../audit-log';


export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listUsers(req.query);
  res.status(200).json(new ApiResponse(200, result, 'Users fetched successfully'));
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id as string);
  res.status(200).json(new ApiResponse(200, user, 'User fetched successfully'));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(new ApiResponse(201, user, 'User created successfully'));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(req.params.id as string, req.body);
  res.status(200).json(new ApiResponse(200, user, 'User updated successfully'));
});

// export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
//   const user = await userService.updateUserRole(req.params.id as string, req.body.role, req.user!.id);
//   res.status(200).json(new ApiResponse(200, user, 'User role updated successfully'));
// });

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const requester = await User.findById(req.user!.id);
  const user = await userService.updateUserRole(req.params.id as string, req.body.role, requester!, getRequestMetadata(req));
  res.status(200).json(new ApiResponse(200, user, 'User role updated successfully'));
});

export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUserStatus(req.params.id as string, req.body.isActive, req.user!.id);
  res.status(200).json(new ApiResponse(200, user, 'User status updated successfully'));
});

// ---- Self-service ----

export const updateOwnProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateOwnProfile(req.user!.id, req.body);
  res.status(200).json(new ApiResponse(200, user, 'Profile updated successfully'));
});

export const changeOwnPassword = asyncHandler(async (req: Request, res: Response) => {
  await userService.changeOwnPassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  res.status(200).json(new ApiResponse(200, null, 'Password changed successfully. Please log in again.'));
});