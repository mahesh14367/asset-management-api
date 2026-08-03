import { Types } from 'mongoose';
import { Employee, IEmployee, EmploymentStatus, EmploymentType } from './employee.model';
import { IUser } from '../user/user.model';
import ApiError from '../../utils/ApiError';
import { getNextSequence } from '../../utils/counter.util';
import { getPaginationParams, buildPaginationMeta, escapeRegex } from '../../utils/pagination.util';
import { createAuditLog, buildActorSnapshot, AuditAction } from '../audit-log';
import { AuditMetadata } from '../audit-log/audit-log.model';
import * as userService from '../user/user.service';
import bcrypt from 'bcrypt';

type Actor = Pick<IUser, '_id' | 'name' | 'email' | 'role'>;

interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  department: string;
  designation: string;
  workLocation: string;
  employmentType?: EmploymentType;
  dateOfJoining: Date;
  reportingManager?: string | null;
}

interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  workLocation?: string;
  employmentType?: EmploymentType;
  reportingManager?: string | null;
}

interface ListEmployeesQuery {
  page?: number;
  limit?: number;
  department?: string;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType;
  search?: string;
}

const sanitizeEmployee = async (employee: IEmployee) => {
  // hasSystemAccess is computed via a live query rather than a stored flag — this is the
  // trade-off of keeping the link one-directional on User (see design rationale above):
  // one extra indexed query per employee, in exchange for zero risk of the flag drifting stale.
  const linkedUser = await userService.findByEmployeeId(employee._id.toString());
  return {
    id: employee._id.toString(),
    employeeCode: employee.employeeCode,
    fullName: `${employee.firstName} ${employee.lastName}`,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation,
    workLocation: employee.workLocation,
    employmentType: employee.employmentType,
    employmentStatus: employee.employmentStatus,
    dateOfJoining: employee.dateOfJoining,
    dateOfLeaving: employee.dateOfLeaving,
    reportingManager: employee.reportingManager,
    hasSystemAccess: Boolean(linkedUser),
    linkedUserId: linkedUser?.id ?? null,
    createdAt: employee.createdAt,
  };
};

export const createEmployee = async (input: CreateEmployeeInput, actor: Actor, metadata: AuditMetadata) => {
  const existing = await Employee.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('An employee with this email already exists');

  if (input.reportingManager) {
    const manager = await Employee.findById(input.reportingManager);
    if (!manager) throw ApiError.badRequest('Reporting manager not found');
  }

  const seq = await getNextSequence('employeeCode');
  const employeeCode = `EMP-${String(seq).padStart(5, '0')}`;

  const employee = await Employee.create({ ...input, employeeCode });

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.EMPLOYEE_CREATED,
    entityType: 'Employee',
    entityId: employee._id.toString(),
    description: `Created employee record ${employee.employeeCode} (${employee.firstName} ${employee.lastName})`,
    metadata,
  });

  return sanitizeEmployee(employee);
};

export const listEmployees = async (query: ListEmployeesQuery) => {
  const { page, limit } = getPaginationParams(query);

  const filter: Record<string, unknown> = {};
  if (query.department) filter.department = query.department;
  if (query.employmentStatus) filter.employmentStatus = query.employmentStatus;
  if (query.employmentType) filter.employmentType = query.employmentType;
  if (query.search) {
    const safe = escapeRegex(query.search);
    filter.$or = [
      { firstName: { $regex: safe, $options: 'i' } },
      { lastName: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { employeeCode: { $regex: safe, $options: 'i' } },
    ];
  }

  const [employees, totalDocs] = await Promise.all([
    Employee.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Employee.countDocuments(filter),
  ]);

  return {
    employees: await Promise.all(employees.map(sanitizeEmployee)),
    pagination: buildPaginationMeta(totalDocs, page, limit),
  };
};

export const getEmployeeById = async (id: string) => {
  const employee = await Employee.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found');
  return sanitizeEmployee(employee);
};

export const updateEmployee = async (
  id: string,
  input: UpdateEmployeeInput,
  actor: Actor,
  metadata: AuditMetadata
) => {
  if (input.email) {
    const existing = await Employee.findOne({ email: input.email, _id: { $ne: id } });
    if (existing) throw ApiError.conflict('This email is already in use by another employee');
  }
  if (input.reportingManager) {
    if (input.reportingManager === id) {
      throw ApiError.badRequest('An employee cannot be their own reporting manager');
    }
    const manager = await Employee.findById(input.reportingManager);
    if (!manager) throw ApiError.badRequest('Reporting manager not found');
  }

  const previous = await Employee.findById(id);
  if (!previous) throw ApiError.notFound('Employee not found');

  const employee = await Employee.findByIdAndUpdate(id, input, { new: true, runValidators: true });

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.EMPLOYEE_UPDATED,
    entityType: 'Employee',
    entityId: id,
    description: `Updated employee ${previous.employeeCode}'s profile`,
    changes: { before: input && Object.fromEntries(Object.keys(input).map((k) => [k, (previous as any)[k]])), after: input as Record<string, unknown> },
    metadata,
  });

  return sanitizeEmployee(employee!);
};

export const updateEmploymentStatus = async (
  id: string,
  status: EmploymentStatus,
  dateOfLeaving: Date | undefined,
  actor: Actor,
  metadata: AuditMetadata
) => {
  const employee = await Employee.findById(id);
  if (!employee) throw ApiError.notFound('Employee not found');

  const previousStatus = employee.employmentStatus;
  employee.employmentStatus = status;
  employee.dateOfLeaving =
    status === EmploymentStatus.RESIGNED || status === EmploymentStatus.TERMINATED ? dateOfLeaving : undefined;
  await employee.save();

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.EMPLOYEE_STATUS_CHANGED,
    entityType: 'Employee',
    entityId: id,
    description: `${employee.employeeCode}'s employment status changed from ${previousStatus} to ${status}`,
    changes: { before: { employmentStatus: previousStatus }, after: { employmentStatus: status } },
    metadata,
  });

  // Cascade rule: offboarding an employee must immediately kill their system access —
  // an ex-employee's login staying active is a real security/compliance gap.
  // (Once the Asset module exists, this is also where you'd flag "N assets still assigned,
  // must be returned/reassigned before offboarding completes" — noted for later, not built yet.)
  if (status === EmploymentStatus.RESIGNED || status === EmploymentStatus.TERMINATED) {
    const linkedUser = await userService.findByEmployeeId(id);
    if (linkedUser) {
      await userService.forceDeactivateUser(linkedUser.id, actor, metadata);
    }
  }

  return sanitizeEmployee(employee);
};

export const grantSystemAccess = async (
  employeeId: string,
  input: { email?: string; password: string; role?: string },
  actor: Actor,
  metadata: AuditMetadata
) => {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  if (employee.employmentStatus !== EmploymentStatus.ACTIVE) {
    throw ApiError.badRequest('Cannot grant system access to an employee who is not active');
  }

  const existingLink = await userService.findByEmployeeId(employeeId);
  if (existingLink) throw ApiError.conflict('This employee already has a linked user account');

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await userService.createUserForEmployee({
    name: `${employee.firstName} ${employee.lastName}`,
    email: input.email ?? employee.email,
    password: hashedPassword,
    role: input.role as any,
    employeeId: employee._id,
  });

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.USER_ACCESS_GRANTED,
    entityType: 'Employee',
    entityId: employeeId,
    description: `Granted system access to ${employee.employeeCode} (${employee.email}) with role ${user.role}`,
    metadata,
  });

  return { employee: await sanitizeEmployee(employee), user };
};

export const revokeSystemAccess = async (employeeId: string, actor: Actor, metadata: AuditMetadata) => {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const linkedUser = await userService.findByEmployeeId(employeeId);
  if (!linkedUser) throw ApiError.badRequest('This employee does not have a linked user account');

  await userService.forceDeactivateUser(linkedUser.id, actor, metadata);

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.USER_ACCESS_REVOKED,
    entityType: 'Employee',
    entityId: employeeId,
    description: `Revoked system access for ${employee.employeeCode} (${employee.email})`,
    metadata,
  });

  return sanitizeEmployee(employee);
};

/** Self-service: an authenticated user views their own linked Employee profile, if any. */
export const getMyEmployeeProfile = async (employeeId: string | null) => {
  if (!employeeId) {
    throw ApiError.notFound('No employee profile is linked to your account. Contact an administrator.');
  }
  return getEmployeeById(employeeId);
};