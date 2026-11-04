import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { disconnectRedis } from './config/redis.js';
import { socketManager } from './sockets/socketManager.js';
import { publisherWorker } from './workers/publisherWorker.js';
import { skuPublisherWorker } from './workers/skuPublisherWorker.js';
import { taskScheduler } from './schedulers/taskScheduler.js';
import { skuTaskScheduler } from './schedulers/skuTaskScheduler.js';
import { logger } from './utils/logger.js';

const server = http.createServer(app);

// Initialize Socket.IO
socketManager.initialize(server);

async function bootstrap() {
  try {
    // 1. Connect MongoDB
    await connectDatabase();

    // 2. Start Publisher Worker & Task Scheduler
    try {
      publisherWorker.start();
      skuPublisherWorker.start();
      taskScheduler.start();
      skuTaskScheduler.start();
    } catch (err: any) {
      logger.warn('Queue/Worker could not start immediately (check Redis):', err.message);
    }

    // 3. Start HTTP Server
    server.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`  XEKO XUKA BULK PUBLISHER - BACKEND API`);
      logger.info(`  Server running at: http://localhost:${env.PORT}`);
      logger.info(`  API Base URL: http://localhost:${env.PORT}/api/v1`);
      logger.info(`  Health Check: http://localhost:${env.PORT}/health`);
      logger.info(`  Environment: ${env.NODE_ENV}`);
      logger.info(`=======================================================`);
    });
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  taskScheduler.stop();
  skuTaskScheduler.stop();
  await publisherWorker.close();
  await skuPublisherWorker.close();
  await disconnectRedis();
  await disconnectDatabase();

  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });

  // Force close after 10s if stuck
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

bootstrap();

