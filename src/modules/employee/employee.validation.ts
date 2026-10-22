import Joi from 'joi';
import { EmploymentType, EmploymentStatus, Department, Designation } from './employee.model';

const objectId = Joi.string().trim().length(24).hex();

export const createEmployeeSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),
  lastName: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().max(20),
  department: Joi.string()
    .valid(...Object.values(Department))
    .required()
    .messages({ 'any.only': `Department must be one of: ${Object.values(Department).join(', ')}` }),
  designation: Joi.string()
    .valid(...Object.values(Designation))
    .required()
    .messages({ 'any.only': `Designation must be one of: ${Object.values(Designation).join(', ')}` }),
  workLocation: Joi.string().trim().max(100).required(),
  employmentType: Joi.string().valid(...Object.values(EmploymentType)).default(EmploymentType.FULL_TIME),
  dateOfJoining: Joi.date().iso().max('now').required(),
  reportingManager: objectId.allow(null),
});

export const updateEmployeeSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName: Joi.string().trim().min(2).max(50),
  email: Joi.string().trim().email(),
  phone: Joi.string().trim().max(20),
  department: Joi.string().valid(...Object.values(Department)),
  designation: Joi.string().valid(...Object.values(Designation)),
  workLocation: Joi.string().trim().max(100),
  employmentType: Joi.string().valid(...Object.values(EmploymentType)),
  reportingManager: objectId.allow(null),
}).min(1);

// Separate endpoint/schema for status changes — same reasoning as User's role/status split:
// offboarding is a sensitive, auditable action with its own rules (dateOfLeaving requirement).
export const updateEmploymentStatusSchema = Joi.object({
  employmentStatus: Joi.string().valid(...Object.values(EmploymentStatus)).required(),
  dateOfLeaving: Joi.date().iso().when('employmentStatus', {
    is: Joi.valid(EmploymentStatus.RESIGNED, EmploymentStatus.TERMINATED),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

export const grantAccessSchema = Joi.object({
  email: Joi.string().trim().email(), // optional override; defaults to the employee's company email
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({ 'string.pattern.base': 'Password must contain uppercase, lowercase, and a number' }),
  role: Joi.string().valid('super_admin', 'asset_manager', 'employee').default('employee'),
});

export const listEmployeesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
  department: Joi.string().valid(...Object.values(Department)),
  employmentStatus: Joi.string().valid(...Object.values(EmploymentStatus)),
  employmentType: Joi.string().valid(...Object.values(EmploymentType)),
  search: Joi.string().trim().max(100),
});