import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let memoryServer: any = null;

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 2000,
      autoIndex: true,
    });
    logger.info(`Connected to MongoDB successfully at ${env.MONGO_URI}`);
  } catch (error: any) {
    if (env.NODE_ENV === 'development') {
      logger.warn(`Không tìm thấy MongoDB local tại ${env.MONGO_URI}. Đang tự động kích hoạt MongoDB In-Memory Server...`);
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        const memoryUri = memoryServer.getUri();
        await mongoose.connect(memoryUri, { autoIndex: true });
        logger.info(`MongoDB In-Memory Server đã khởi chạy thành công tại: ${memoryUri}`);
        return;
      } catch (memError) {
        logger.error('Không thể khởi tạo In-Memory MongoDB:', memError);
      }
    }

    logger.error('Failed to connect to MongoDB:', error.message);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
  logger.info('Disconnected from MongoDB');
}

