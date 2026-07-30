import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/asset-management',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    accessExpire: process.env.JWT_ACCESS_EXPIRE || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
    refreshCookieMaxAgeMs: parseInt(process.env.JWT_REFRESH_COOKIE_MAXAGE_MS || '604800000', 10),
  },
};