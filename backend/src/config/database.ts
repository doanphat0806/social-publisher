import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Global cache for serverless environments (Vercel / AWS Lambda)
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectDatabase(): Promise<typeof mongoose> {
  // If connection already established, return it immediately
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);

    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // 5s timeout within Vercel's limit
      autoIndex: true,
    };

    logger.info('Connecting to MongoDB...');
    cached.promise = mongoose.connect(env.MONGO_URI, opts).then((m) => {
      logger.info('Connected to MongoDB successfully');
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error: any) {
    cached.promise = null;
    logger.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  cached.conn = null;
  cached.promise = null;
  logger.info('Disconnected from MongoDB');
}
