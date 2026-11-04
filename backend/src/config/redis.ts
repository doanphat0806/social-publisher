import { Redis, RedisOptions } from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    if (env.NODE_ENV === 'development' && times > 5) {
      return null; // Stop endless retry spam if redis is not running locally
    }
    const delay = Math.min(times * 1000, 5000);
    return delay;
  },
};

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, redisOptions);

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err.message);
    });
  }
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Disconnected from Redis');
  }
}

