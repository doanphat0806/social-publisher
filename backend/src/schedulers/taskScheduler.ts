import { PublishTask, Campaign, FacebookPage } from '../models/index.js';
import { queueManager } from '../queues/queueManager.js';
import { socketManager } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';

export class TaskScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isScanning = false;
  private intervalMs = 10000; // Scan every 10 seconds

  start(): void {
    if (this.timer) return;

    logger.info(`TaskScheduler started (interval: ${this.intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.scanAndEnqueueDueTasks();
    }, this.intervalMs);

    // Initial scan immediately
    this.scanAndEnqueueDueTasks();
  }

  async scanAndEnqueueDueTasks(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const now = new Date();

      // Find pending tasks whose scheduledAt is <= now
      const dueTasks = await PublishTask.find({
        status: 'pending',
        scheduledAt: { $lte: now },
      })
        .populate('campaignId')
        .limit(50); // Batch size

      if (dueTasks.length === 0) {
        this.isScanning = false;
        return;
      }

      logger.info(`Scheduler found ${dueTasks.length} due tasks to process`);
      const queue = queueManager.getPublishQueue();

      for (const task of dueTasks) {
        const campaign = task.campaignId as any;

        // Verify parent Campaign is active
        if (!campaign || (campaign.status !== 'scheduled' && campaign.status !== 'running')) {
          continue;
        }

        // Verify Facebook Page is active
        const page = await FacebookPage.findOne({ pageId: task.pageId, status: 'active' });
        if (!page) {
          logger.warn(`Task ${task._id} skipped: Facebook Page ${task.pageId} is not active or not found`);
          continue;
        }

        // Add job to BullMQ with deterministic jobId = task._id.toString()
        // BullMQ deduplicates jobs with the same jobId
        await queue.add(
          'publish-task',
          {
            taskId: task._id.toString(),
            campaignId: campaign._id.toString(),
            postId: task.postId.toString(),
            pageId: task.pageId,
          },
          {
            jobId: task._id.toString(),
          }
        );

        // Mark task as queued
        task.status = 'queued';
        await task.save();

        socketManager.emitToUser(campaign.userId.toString(), 'publish:queued', {
          taskId: task._id,
          campaignId: campaign._id,
          pageId: task.pageId,
          scheduledAt: task.scheduledAt,
        });

        logger.info(`Task ${task._id} queued to BullMQ for page ${task.pageId}`);
      }
    } catch (error: any) {
      logger.error('Error during scheduler scan:', error.message);
    } finally {
      this.isScanning = false;
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('TaskScheduler stopped');
    }
  }
}

export const taskScheduler = new TaskScheduler();

