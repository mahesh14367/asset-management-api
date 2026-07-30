import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User, UserRole, IUser } from '../user/user.model';
import ApiError from '../../utils/ApiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.util';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface ForgotPasswordInput {
  email: string;
}

interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const generateTokens = async (user: IUser): Promise<AuthTokens> => {
  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

const sanitizeUser = (user: IUser) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

export const register = async (input: RegisterInput) => {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await User.create({
    name: input.name,
    email: input.email,
    password: hashedPassword,
    role: UserRole.EMPLOYEE,
  });

  const tokens = await generateTokens(user);
  return { user: sanitizeUser(user), ...tokens };
};

export const login = async (input: LoginInput) => {
  const user = await User.findOne({ email: input.email }).select('+password');

  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Contact an administrator.');
  }

  const tokens = await generateTokens(user);
  return { user: sanitizeUser(user), ...tokens };
};

export const refreshAccessToken = async (incomingToken: string): Promise<AuthTokens> => {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(incomingToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired session, please log in again');
  }

  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash) {
    throw ApiError.unauthorized('Invalid session, please log in again');
  }

  const isValid = await bcrypt.compare(incomingToken, user.refreshTokenHash);
  if (!isValid) {
    await User.findByIdAndUpdate(user._id, { $unset: { refreshTokenHash: 1 } });
    throw ApiError.unauthorized('Session invalidated for security reasons, please log in again');
  }

  return generateTokens(user);
};

export const logout = async (userId: string): Promise<void> => {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return sanitizeUser(user);
};

export const forgotPassword = async (input: ForgotPasswordInput) => {
  const user = await User.findOne({ email: input.email });
  if (!user) {
    return { message: 'If an account with this email exists, a password reset link has been sent.' };
  }

  const resetToken = generateResetToken();
  const resetExpires = new Date(Date.now() + 10 * 60 * 1000);

  user.passwordResetToken = resetToken;
  user.passwordResetExpires = resetExpires;
  await user.save({ validateBeforeSave: false });

  console.log('Password reset token:', resetToken);
  console.log('Reset link would be: http://localhost:3000/reset-password?token=' + resetToken);

  return { message: 'If an account with this email exists, a password reset link has been sent.' };
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const user = await User.findOne({
    passwordResetToken: input.token,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  const hashedPassword = await bcrypt.hash(input.newPassword, 10);
  user.password = hashedPassword;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  user.passwordChangedAt = new Date();
  await user.save();

  await User.findByIdAndUpdate(user._id, { $unset: { refreshTokenHash: 1 } });

  return { message: 'Password reset successfully. Please log in with your new password.' };
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw ApiError.unauthorized('Current password is incorrect');

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  delete user.refreshTokenHash;
  await user.save();
};
