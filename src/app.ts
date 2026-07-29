import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { config } from './config';

export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet());

  // CORS configuration
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));

  // Body parsing middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Compression middleware
  app.use(compression());

  // Logging middleware
  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check route
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      message: 'Asset Management API is running',
      environment: config.nodeEnv,
    });
  });

  // API routes will be added here
  // app.use('/api/v1', routes);

  return app;
};