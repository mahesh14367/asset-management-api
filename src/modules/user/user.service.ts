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

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

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

export const createUser = async (input: CreateUserInput) => {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: hashedPassword,
    role: input.role ?? UserRole.EMPLOYEE,
  });

  return sanitizeUser(user);
};

export const updateUser = async (id: string, input: UpdateUserInput) => {
  if (input.email) {
    const existing = await User.findOne({ email: input.email, _id: { $ne: id } });
    if (existing) throw ApiError.conflict('This email is already in use by another account');
  }

  const user = await User.findByIdAndUpdate(id, input, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeUser(user);
};

// export const updateUserRole = async (id: string, role: UserRole, requesterId: string) => {
//   if (id === requesterId) {
//     throw ApiError.badRequest('You cannot change your own role');
//   }

//   const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true });
//   if (!user) throw ApiError.notFound('User not found');
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
    entityId: new Types.ObjectId(id),
    description: `Changed ${user.email}'s role from ${previousUser.role} to ${role}`,
    changes: { before: { role: previousUser.role }, after: { role } },
    metadata,
  });

  return sanitizeUser(user);
};

export const updateUserStatus = async (id: string, isActive: boolean, requesterId: string) => {
  if (id === requesterId && !isActive) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const user = await User.findByIdAndUpdate(
    id,
    { isActive, ...(isActive ? {} : { $unset: { refreshTokenHash: 1 } }) },
    { new: true, runValidators: true }
  );
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeUser(user);
};

export const updateOwnProfile = async (userId: string, input: UpdateUserInput) => {
  return updateUser(userId, input);
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
