import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import * as employeeService from './employee.service';
import { getRequestMetadata } from '../audit-log';

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.createEmployee(req.body, req.actor!, getRequestMetadata(req));
  res.status(201).json(new ApiResponse(201, employee, 'Employee created successfully'));
});

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const result = await employeeService.listEmployees(req.query);
  res.status(200).json(new ApiResponse(200, result, 'Employees fetched successfully'));
});

export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.getEmployeeById(req.params.id as string);
  res.status(200).json(new ApiResponse(200, employee, 'Employee fetched successfully'));
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.updateEmployee(
    req.params.id as string,
    req.body,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, employee, 'Employee updated successfully'));
});

export const updateEmploymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.updateEmploymentStatus(
    req.params.id as string,
    req.body.employmentStatus,
    req.body.dateOfLeaving,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, employee, 'Employment status updated successfully'));
});

export const grantSystemAccess = asyncHandler(async (req: Request, res: Response) => {
  const result = await employeeService.grantSystemAccess(
    req.params.id as string,
    req.body,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(201).json(new ApiResponse(201, result, 'System access granted successfully'));
});

export const revokeSystemAccess = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.revokeSystemAccess(
    req.params.id as string,
    req.actor!,
    getRequestMetadata(req)
  );
  res.status(200).json(new ApiResponse(200, employee, 'System access revoked successfully'));
});

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.getMyEmployeeProfile(req.user!.employeeId);
  res.status(200).json(new ApiResponse(200, employee, 'Employee profile fetched successfully'));
});