import { Worker, Job } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { PUBLISH_QUEUE_NAME } from '../queues/queueManager.js';
import { PublishTask, Campaign, Post, FacebookPage, MediaAsset, PublishLog } from '../models/index.js';
import { facebookGraphService } from '../services/facebookGraph.service.js';
import { mediaStorageService } from '../services/mediaStorage.service.js';
import { decryptToken } from '../utils/crypto.js';
import { socketManager } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface PublishJobData {
  taskId: string;
  campaignId: string;
  postId: string;
  pageId: string;
}

export class PublisherWorker {
  private worker: Worker | null = null;

  start(): void {
    if (this.worker) return;

    this.worker = new Worker(
      PUBLISH_QUEUE_NAME,
      async (job: Job<PublishJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisOptions,
        concurrency: 5, // Concurrent execution across different pages
      }
    );

    this.worker.on('completed', (job) => {
      logger.info(`Job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Job failed: ${job?.id} error: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      // Gracefully handle Redis connection drops/absence
      logger.warn(`PublisherWorker connection warning (Redis): ${err.message}`);
    });

    logger.info('PublisherWorker started');
  }

  async processJob(job: Job<PublishJobData>): Promise<void> {
    const { taskId, campaignId, postId, pageId } = job.data;

    const task = await PublishTask.findById(taskId);
    if (!task) {
      logger.warn(`Task ${taskId} not found. Skipping.`);
      return;
    }

    // Idempotency check: If already success or cancelled, ignore
    if (task.status === 'success' || task.status === 'cancelled') {
      logger.info(`Task ${taskId} is already in state '${task.status}'. Skipping.`);
      return;
    }

    // 1. Check Campaign state
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || campaign.status === 'paused' || campaign.status === 'cancelled') {
      logger.info(`Campaign ${campaignId} is paused or cancelled. Delaying/skipping task ${taskId}.`);
      task.status = campaign?.status === 'paused' ? 'paused' : 'cancelled';
      await task.save();
      return;
    }

    // Mark task as processing
    task.status = 'processing';
    task.startedAt = new Date();
    task.attemptCount += 1;
    await task.save();

    socketManager.emitToUser(campaign.userId.toString(), 'publish:processing', {
      taskId: task._id,
      campaignId: campaign._id,
      pageId,
    });

    // 2. Fetch Facebook Page and decrypt access token
    const fbPage = await FacebookPage.findOne({ pageId, userId: campaign.userId });
    if (!fbPage || fbPage.status !== 'active') {
      const errMsg = !fbPage ? 'Không tìm thấy thông tin Fanpage' : `Fanpage đang ở trạng thái ${fbPage.status}`;
      task.status = 'failed';
      task.errorMessage = errMsg;
      await task.save();

      await PublishLog.create({
        taskId: task._id,
        action: 'page_check',
        errorMessage: errMsg,
      });

      this.updateCampaignStats(campaign._id.toString());
      return;
    }

    let pageAccessToken: string;
    try {
      pageAccessToken = decryptToken(fbPage.pageAccessTokenEncrypted);
    } catch (err: any) {
      task.status = 'failed';
      task.errorMessage = 'Lỗi giải mã token Fanpage: ' + err.message;
      await task.save();
      return;
    }

    // 3. Fetch Post and associated MediaAssets
    const post = await Post.findById(postId);
    if (!post) {
      task.status = 'failed';
      task.errorMessage = 'Không tìm thấy nội dung bài viết';
      await task.save();
      return;
    }

    const mediaAssets = await MediaAsset.find({ _id: { $in: post.mediaIds } });
    if (mediaAssets.length === 0) {
      task.status = 'failed';
      task.errorMessage = 'Bài viết không có hình ảnh nào';
      await task.save();
      return;
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${env.PORT}`;

    // 4. Step: Upload unpublished photos (resumable)
    // task.facebookPhotoIds stores already uploaded photo IDs to avoid re-uploading on retry
    const photoIds: string[] = [...(task.facebookPhotoIds || [])];

    try {
      for (let i = photoIds.length; i < mediaAssets.length; i++) {
        const asset = mediaAssets[i];
        const imageUrl = mediaStorageService.getFileUrl(asset.storageKey, baseUrl);

        logger.info(`Uploading photo ${i + 1}/${mediaAssets.length} for page ${pageId}...`);
        const photoResult = await facebookGraphService.uploadUnpublishedPhoto(
          pageId,
          pageAccessToken,
          imageUrl,
          post.caption
        );

        photoIds.push(photoResult.id);
        task.facebookPhotoIds = photoIds;
        await task.save();

        await PublishLog.create({
          taskId: task._id,
          action: 'photo_upload',
          responseData: { photoId: photoResult.id, assetId: asset._id },
        });
      }

      // 5. Step: Create Multi-photo Feed Post
      logger.info(`Publishing feed post with ${photoIds.length} photos to page ${pageId}...`);
      const feedResult = await facebookGraphService.createMultiPhotoPost(
        pageId,
        pageAccessToken,
        post.caption,
        photoIds
      );

      // Successfully published!
      task.status = 'success';
      task.facebookPostId = feedResult.id;
      task.facebookPostUrl = feedResult.postUrl;
      task.publishedAt = new Date();
      task.errorMessage = undefined;
      task.errorCode = undefined;
      await task.save();

      await PublishLog.create({
        taskId: task._id,
        action: 'feed_post',
        responseData: { postId: feedResult.id, postUrl: feedResult.postUrl },
      });

      socketManager.emitToUser(campaign.userId.toString(), 'publish:success', {
        taskId: task._id,
        campaignId: campaign._id,
        postId: post._id,
        pageId,
        facebookPostId: feedResult.id,
        facebookPostUrl: feedResult.postUrl,
      });

      await this.updateCampaignStats(campaign._id.toString());
      logger.info(`Post published successfully! Page: ${pageId}, Post ID: ${feedResult.id}`);
    } catch (error: any) {
      const errDetails = facebookGraphService.parseError(error);
      logger.error(`Error publishing to page ${pageId}:`, errDetails);

      task.errorCode = errDetails.code ? errDetails.code.toString() : errDetails.type;
      task.errorMessage = errDetails.message;

      // Handle specific error types
      if (errDetails.type === 'TOKEN_EXPIRED') {
        fbPage.status = 'expired';
        await fbPage.save();
        task.status = 'failed';
      } else if (errDetails.type === 'PERMISSION_DENIED') {
        fbPage.status = 'permission_denied';
        await fbPage.save();
        task.status = 'failed';
      } else if (errDetails.type === 'NETWORK_TIMEOUT') {
        // Unknown outcome: check if post was actually created
        if (task.facebookPostId) {
          const exists = await facebookGraphService.verifyPostExists(task.facebookPostId, pageAccessToken);
          if (exists) {
            task.status = 'success';
            await task.save();
            await this.updateCampaignStats(campaign._id.toString());
            return;
          }
        }
        task.status = 'unknown';
      } else {
        // If max attempts reached or non-retryable
        if (!errDetails.retryable || task.attemptCount >= task.maxAttempts) {
          task.status = 'failed';
        } else {
          task.status = 'pending'; // Allow scheduler/BullMQ to retry
        }
      }

      await task.save();

      await PublishLog.create({
        taskId: task._id,
        action: 'error',
        errorMessage: errDetails.message,
        responseCode: errDetails.code,
      });

      socketManager.emitToUser(campaign.userId.toString(), 'publish:failed', {
        taskId: task._id,
        campaignId: campaign._id,
        pageId,
        error: errDetails.message,
      });

      await this.updateCampaignStats(campaign._id.toString());

      // If retryable, throw error so BullMQ can trigger backoff
      if (errDetails.retryable && task.attemptCount < task.maxAttempts) {
        throw new Error(errDetails.message);
      }
    }
  }

  /**
   * Recalculates and updates Campaign stats
   */
  async updateCampaignStats(campaignId: string): Promise<void> {
    const tasks = await PublishTask.find({ campaignId });
    const successfulPublishes = tasks.filter(t => t.status === 'success').length;
    const failedPublishes = tasks.filter(t => t.status === 'failed').length;
    const pendingPublishes = tasks.filter(t => t.status === 'pending' || t.status === 'queued').length;
    const processingPublishes = tasks.filter(t => t.status === 'processing').length;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return;

    campaign.stats.successfulPublishes = successfulPublishes;
    campaign.stats.failedPublishes = failedPublishes;
    campaign.stats.pendingPublishes = pendingPublishes;
    campaign.stats.processingPublishes = processingPublishes;

    // Check completion
    if (pendingPublishes === 0 && processingPublishes === 0) {
      if (successfulPublishes > 0 && failedPublishes === 0) {
        campaign.status = 'completed';
      } else if (successfulPublishes > 0 && failedPublishes > 0) {
        campaign.status = 'completed'; // completed with partial failures
      } else if (successfulPublishes === 0 && failedPublishes > 0) {
        campaign.status = 'failed';
      }
      socketManager.emitToUser(campaign.userId.toString(), 'campaign:completed', {
        campaignId: campaign._id,
        status: campaign.status,
      });
    } else if (campaign.status === 'scheduled' && (processingPublishes > 0 || successfulPublishes > 0)) {
      campaign.status = 'running';
    }

    await campaign.save();
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}

export const publisherWorker = new PublisherWorker();

