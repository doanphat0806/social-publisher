import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const PUBLISH_QUEUE_NAME = 'facebook-publish-queue';
export const SKU_PUBLISH_QUEUE_NAME = 'facebook-sku-publish-queue';

export class QueueManager {
  private queue: Queue | null = null;
  private skuQueue: Queue | null = null;

  getPublishQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(PUBLISH_QUEUE_NAME, {
        connection: redisOptions,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 10000, // 10 seconds base backoff
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 1000,
          },
        },
      });

      this.queue.on('error', (err) => {
        logger.error('PublishQueue error:', err.message);
      });

      logger.info(`BullMQ Queue initialized: ${PUBLISH_QUEUE_NAME}`);
    }
    return this.queue;
  }

  getSkuPublishQueue(): Queue {
    if (!this.skuQueue) {
      this.skuQueue = new Queue(SKU_PUBLISH_QUEUE_NAME, {
        connection: redisOptions,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 1000,
          },
        },
      });

      this.skuQueue.on('error', (err) => {
        logger.error('SkuPublishQueue error:', err.message);
      });

      logger.info(`BullMQ Queue initialized: ${SKU_PUBLISH_QUEUE_NAME}`);
    }
    return this.skuQueue;
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    if (this.skuQueue) {
      await this.skuQueue.close();
      this.skuQueue = null;
    }
  }
}

export const queueManager = new QueueManager();

