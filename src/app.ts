import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config } from './config';
import { notFound } from './middlewares/notFound.middleware';
import { globalErrorHandler } from './middlewares/error.middleware';
import { authRoutes } from './modules/auth';
import { userRoutes } from './modules/user';
import { auditLogRoutes } from './modules/audit-log';
import { employeeRoutes } from './modules/employee';
import { assetRoutes } from './modules/asset';
import { assetAssignmentRoutes } from './modules/asset-assignment';

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression());

  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Asset Management API is running', environment: config.nodeEnv });
  });

  // API routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/audit-logs', auditLogRoutes);
  app.use('/api/v1/employees', employeeRoutes);
  app.use('/api/v1/assets', assetRoutes);
  app.use('/api/v1/asset-assignments', assetAssignmentRoutes);

  console.log(`server endpoint: http://localhost:${config.port}/api/v1/`);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Asset Management API is running', environment: config.nodeEnv });
  });
  
  app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Asset Management API is running', environment: config.nodeEnv });
  });

  // ⚠️ Must stay last
  app.use(notFound);
  app.use(globalErrorHandler);

  return app;
};