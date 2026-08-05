import { User, UserRole, IUser } from './user.model';
import ApiError from '../../utils/ApiError';
import { getPaginationParams, buildPaginationMeta, escapeRegex } from '../../utils/pagination.util';
import bcrypt from 'bcrypt';
import { createAuditLog, buildActorSnapshot, AuditAction } from '../audit-log';
import { AuditMetadata } from '../audit-log/audit-log.model';
import { Types } from 'mongoose';

interface ListUsersQuery {
  page?: number;
  limit?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

// interface CreateUserInput {
//   name: string;
//   email: string;
//   password: string;
//   role?: UserRole;
// }

interface UpdateUserInput {
  name?: string;
  email?: string;
}

const sanitizeUser = (user: IUser) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  employeeId: user.employeeId ? user.employeeId.toString() : null,
  createdAt: user.createdAt,
});

export const listUsers = async (query: ListUsersQuery) => {
  const { page, limit } = getPaginationParams(query);

  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) {
    const safe = escapeRegex(query.search);
    filter.$or = [{ name: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }];
  }

  const [users, totalDocs] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    users: users.map(sanitizeUser),
    pagination: buildPaginationMeta(totalDocs, page, limit),
  };
};

export const getUserById = async (id: string) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeUser(user);
};

// NEW — used by employee.service.ts to check "does this employee already have a login?"
export const findByEmployeeId = async (employeeId: string) => {
  const user = await User.findOne({ employeeId });
  return user ? sanitizeUser(user) : null;
};

// NEW — the ONLY way an employee-linked account gets created (see routing note above).
// Distinct from the general-purpose `createUser` — this one requires an employeeId
// and is only ever called from employee.service.ts's grantSystemAccess flow.
export const createUserForEmployee = async (input: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  employeeId: Types.ObjectId;
}) => {
  const existingEmail = await User.findOne({ email: input.email });
  if (existingEmail) throw ApiError.conflict('A user account with this email already exists');

  const existingLink = await User.findOne({ employeeId: input.employeeId });
  if (existingLink) throw ApiError.conflict('This employee already has a linked user account');

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: hashedPassword,
    role: input.role ?? UserRole.EMPLOYEE,
    employeeId: input.employeeId,
  });

  return sanitizeUser(user);
};

// export const createUser = async (input: CreateUserInput) => {
//   const existingEmail = await User.findOne({ email: input.email });
//   if (existingEmail) throw ApiError.conflict('A user account with this email already exists');

//   const hashedPassword = await bcrypt.hash(input.password, 10);

//   const user = await User.create({
//     name: input.name,
//     email: input.email,
//     password: hashedPassword,
//     role: input.role ?? UserRole.EMPLOYEE,
//   });

//   return sanitizeUser(user);
// };

export const updateUserRole = async (
  id: string,
  role: UserRole,
  requester: Pick<IUser, '_id' | 'name' | 'email' | 'role'>,
  metadata: AuditMetadata
) => {
  if (id === requester._id.toString()) {
    throw ApiError.badRequest('You cannot change your own role');
  }

  const previousUser = await User.findById(id);
  if (!previousUser) throw ApiError.notFound('User not found');

  const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');

  await createAuditLog({
    actor: buildActorSnapshot(requester),
    action: AuditAction.USER_ROLE_CHANGED,
    entityType: 'User',
    entityId: id,
    description: `Changed ${user.email}'s role from ${previousUser.role} to ${role}`,
    changes: { before: { role: previousUser.role }, after: { role } },
    metadata,
  });

  return sanitizeUser(user);
};


export const updateOwnProfile = async (userId: string, input: UpdateUserInput) => {
  if (input.email) {
    const existing = await User.findOne({ email: input.email, _id: { $ne: userId } });
    if (existing) throw ApiError.conflict('This email is already in use by another account');
  }

  const user = await User.findByIdAndUpdate(userId, input, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeUser(user);
};

export const changeOwnPassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect');

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  delete user.refreshTokenHash;
  await user.save();
};

// Force deactivation — used by employee.service.ts when offboarding an employee.
// Unlike updateUserStatus, this bypasses the self-deactivation check since it's
// called as part of an automated cascade (employee status change → user deactivation).
export const forceDeactivateUser = async (
  userId: string,
  actor: Pick<IUser, '_id' | 'name' | 'email' | 'role'>,
  metadata: AuditMetadata
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false, $unset: { refreshTokenHash: 1 } },
    { new: true, runValidators: true }
  );
  if (!user) throw ApiError.notFound('User not found');

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.USER_STATUS_CHANGED,
    entityType: 'User',
    entityId: userId,
    description: `Force deactivated user ${user.email} due to employee offboarding`,
    changes: { before: { isActive: true }, after: { isActive: false } },
    metadata,
  });

  return sanitizeUser(user);
};
