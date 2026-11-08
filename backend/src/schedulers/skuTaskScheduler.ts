import { SkuPublishTask, SkuPostingCampaign, FacebookPage } from '../models/index.js';
import { queueManager } from '../queues/queueManager.js';
import { skuPublisherWorker } from '../workers/skuPublisherWorker.js';
import { socketManager } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';

export class SkuTaskScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isScanning = false;
  private intervalMs = 10000; // Scan every 10 seconds

  start(): void {
    if (this.timer) return;

    logger.info(`SkuTaskScheduler started (interval: ${this.intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.scanAndEnqueueDueTasks();
    }, this.intervalMs);

    // Initial scan
    this.scanAndEnqueueDueTasks();
  }

  async scanAndEnqueueDueTasks(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const now = new Date();

      const dueTasks = await SkuPublishTask.find({
        status: 'pending',
        scheduledAt: { $lte: now },
      })
        .populate('campaignId')
        .limit(50);

      if (dueTasks.length === 0) {
        this.isScanning = false;
        return;
      }

      logger.info(`SkuTaskScheduler found ${dueTasks.length} due tasks to process`);
      const queue = queueManager.getSkuPublishQueue();

      for (const task of dueTasks) {
        const campaign = task.campaignId as any;

        // Verify parent Campaign is active
        if (!campaign || (campaign.status !== 'scheduled' && campaign.status !== 'publishing')) {
          continue;
        }

        // Verify Facebook Page is active
        const page = await FacebookPage.findOne({ pageId: task.pageId, status: 'active' });
        if (!page) {
          logger.warn(`Sku task ${task._id} skipped: Facebook Page ${task.pageId} is not active`);
          continue;
        }

        // Attempt to queue via BullMQ (Redis), or fallback directly if Redis is not running
        try {
          await queue.add(
            'sku-publish-task',
            {
              taskId: task._id.toString(),
              campaignId: campaign._id.toString(),
              productId: task.productId.toString(),
              pageId: task.pageId,
            },
            {
              jobId: `sku_${task._id.toString()}`,
            }
          );

          task.status = 'queued';
          await task.save();

          socketManager.emitToUser(campaign.userId.toString(), 'sku:publish:queued', {
            taskId: task._id,
            campaignId: campaign._id,
            productCode: task.productCode,
            pageId: task.pageId,
          });
        } catch (queueErr: any) {
          logger.warn(
            `Redis/BullMQ không khả dụng (${queueErr.message}). Tự động chuyển sang chế độ thực thi trực tiếp cho task SKU ${task._id}...`
          );

          // Mark task as processing to avoid duplicate runs
          task.status = 'queued';
          await task.save();

          // Execute directly in-process
          try {
            await skuPublisherWorker.processJob({
              data: {
                taskId: task._id.toString(),
                campaignId: campaign._id.toString(),
                productId: task.productId.toString(),
                pageId: task.pageId,
              },
            } as any);
          } catch (execErr: any) {
            logger.error(`Direct execution error for task ${task._id}:`, execErr.message);
          }
        }
      }
    } catch (err: any) {
      logger.error('SkuTaskScheduler error:', err);
    } finally {
      this.isScanning = false;
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('SkuTaskScheduler stopped');
    }
  }
}

export const skuTaskScheduler = new SkuTaskScheduler();

