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
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local', // 's3' | 'minio' | 'local'
    s3: {
      bucket:          process.env.AWS_S3_BUCKET           || '',
      region:          process.env.AWS_REGION               || 'us-east-1',
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID        || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY    || '',
    },
    minio: {
      endpoint:  process.env.MINIO_ENDPOINT   || 'http://localhost:9000',
      bucket:    process.env.MINIO_BUCKET     || 'assets',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    },
    local: {
      uploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
      baseUrl:   process.env.LOCAL_BASE_URL   || 'http://localhost:3000',
    },
  },
};