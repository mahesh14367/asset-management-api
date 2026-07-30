import { createApp } from './app';
import { connectDatabase } from './config/database';
import { config } from './config';
import { logger } from './config/logger';

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    const app = createApp();

    app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port} in ${config.nodeEnv} mode`);
      
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error as Error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err: Error) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1); // fail fast — let PM2/Docker restart with a clean state
});

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();