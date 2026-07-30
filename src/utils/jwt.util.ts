import jwt, { SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { config } from '../config';
import { UserRole } from '../modules/user/user.model';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export const signAccessToken = (userId: Types.ObjectId, role: UserRole): string => {
  return jwt.sign({ sub: userId.toString(), role }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpire,
  } as SignOptions);
};

export const signRefreshToken = (userId: Types.ObjectId): string => {
  return jwt.sign({ sub: userId.toString() }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpire,
  } as SignOptions);
};

export const verifyAccessToken = (token: string): AccessTokenPayload & { iat: number; exp: number } => {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload & { iat: number; exp: number };
};

export const verifyRefreshToken = (token: string): { sub: string; iat: number; exp: number } => {
  return jwt.verify(token, config.jwt.refreshSecret) as { sub: string; iat: number; exp: number };
};