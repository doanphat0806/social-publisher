import { Worker, Job } from 'bullmq';
import { redisOptions } from '../config/redis.js';
import { SKU_PUBLISH_QUEUE_NAME } from '../queues/queueManager.js';
import {
  SkuPublishTask,
  SkuPostingCampaign,
  SkuProduct,
  FacebookPage,
  MediaAsset,
  PublishLog,
} from '../models/index.js';
import { facebookGraphService } from '../services/facebookGraph.service.js';
import { mediaStorageService } from '../services/mediaStorage.service.js';
import { decryptToken } from '../utils/crypto.js';
import { socketManager } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface SkuPublishJobData {
  taskId: string;
  campaignId: string;
  productId: string;
  pageId: string;
}

export class SkuPublisherWorker {
  private worker: Worker | null = null;

  start(): void {
    if (this.worker) return;

    this.worker = new Worker(
      SKU_PUBLISH_QUEUE_NAME,
      async (job: Job<SkuPublishJobData>) => {
        await this.processJob(job);
      },
      {
        connection: redisOptions,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.info(`SkuPublisherWorker Job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`SkuPublisherWorker Job failed: ${job?.id} error: ${err.message}`);
    });

    this.worker.on('error', (err) => {
      // Gracefully handle Redis connection drops/absence
      logger.warn(`SkuPublisherWorker connection warning (Redis): ${err.message}`);
    });

    logger.info('SkuPublisherWorker started');
  }

  async processJob(job: Job<SkuPublishJobData>): Promise<void> {
    const { taskId, campaignId, productId, pageId } = job.data;

    const task = await SkuPublishTask.findById(taskId);
    if (!task) {
      logger.warn(`SkuPublishTask ${taskId} not found. Skipping.`);
      return;
    }

    // Idempotency check: If already success or cancelled, ignore
    if (task.status === 'success' || task.status === 'cancelled' || task.status === 'skipped') {
      logger.info(`SkuPublishTask ${taskId} is already '${task.status}'. Skipping.`);
      return;
    }

    // 1. Check Campaign state
    const campaign = await SkuPostingCampaign.findById(campaignId);
    if (!campaign || campaign.status === 'paused' || campaign.status === 'cancelled') {
      logger.info(`Campaign ${campaignId} is paused or cancelled. Skipping task ${taskId}.`);
      task.status = campaign?.status === 'paused' ? 'paused' : 'cancelled';
      await task.save();
      return;
    }

    // Mark task as processing
    task.status = 'processing';
    task.startedAt = new Date();
    task.attemptCount += 1;
    await task.save();

    socketManager.emitToUser(campaign.userId.toString(), 'sku:publish:processing', {
      taskId: task._id,
      campaignId: campaign._id,
      productCode: task.productCode,
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

      await this.updateCampaignStats(campaign._id.toString());
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

    // 3. Fetch MediaAssets for this SKU product
    const mediaAssets = await MediaAsset.find({ _id: { $in: task.mediaAssetIds } });
    if (mediaAssets.length === 0) {
      task.status = 'failed';
      task.errorMessage = `Mã sản phẩm ${task.productCode} không có hình ảnh nào hợp lệ`;
      await task.save();
      await this.updateCampaignStats(campaign._id.toString());
      return;
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${env.PORT}`;
    const photoIds: string[] = [...(task.facebookPhotoIds || [])];

    try {
      // 4. Upload unpublished photos resumably
      for (let i = photoIds.length; i < mediaAssets.length; i++) {
        const asset = mediaAssets[i];
        const imageUrl = mediaStorageService.getFileUrl(asset.storageKey, baseUrl);

        logger.info(`Uploading SKU ${task.productCode} photo ${i + 1}/${mediaAssets.length} for page ${pageId}...`);
        const photoResult = await facebookGraphService.uploadUnpublishedPhoto(
          pageId,
          pageAccessToken,
          imageUrl,
          task.caption
        );

        photoIds.push(photoResult.id);
        task.facebookPhotoIds = photoIds;
        await task.save();

        await PublishLog.create({
          taskId: task._id,
          action: 'photo_upload',
          responseData: { photoId: photoResult.id, assetId: asset._id, sku: task.productCode },
        });
      }

      // 5. Create Multi-photo Feed Post
      logger.info(`Publishing SKU ${task.productCode} feed post (${photoIds.length} photos) to page ${pageId}...`);
      const feedResult = await facebookGraphService.createMultiPhotoPost(
        pageId,
        pageAccessToken,
        task.caption,
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
        responseData: { postId: feedResult.id, postUrl: feedResult.postUrl, sku: task.productCode },
      });

      socketManager.emitToUser(campaign.userId.toString(), 'sku:publish:success', {
        taskId: task._id,
        campaignId: campaign._id,
        productId,
        productCode: task.productCode,
        pageId,
        facebookPostId: feedResult.id,
        facebookPostUrl: feedResult.postUrl,
      });

      await this.updateCampaignStats(campaign._id.toString());
      logger.info(`SKU ${task.productCode} post published successfully! Page: ${pageId}, Post ID: ${feedResult.id}`);
    } catch (error: any) {
      const errDetails = facebookGraphService.parseError(error);
      logger.error(`Error publishing SKU ${task.productCode} to page ${pageId}:`, errDetails);

      task.errorCode = errDetails.code ? errDetails.code.toString() : errDetails.type;
      task.errorMessage = errDetails.message;

      if (errDetails.type === 'TOKEN_EXPIRED') {
        fbPage.status = 'expired';
        await fbPage.save();
        task.status = 'failed';
      } else if (errDetails.type === 'PERMISSION_DENIED') {
        fbPage.status = 'permission_denied';
        await fbPage.save();
        task.status = 'failed';
      } else if (errDetails.type === 'NETWORK_TIMEOUT') {
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
        task.status = 'failed';
      }

      await task.save();

      await PublishLog.create({
        taskId: task._id,
        action: 'feed_post_error',
        errorCode: task.errorCode,
        errorMessage: task.errorMessage,
      });

      socketManager.emitToUser(campaign.userId.toString(), 'sku:publish:failed', {
        taskId: task._id,
        campaignId: campaign._id,
        productCode: task.productCode,
        pageId,
        errorMessage: task.errorMessage,
      });

      await this.updateCampaignStats(campaign._id.toString());

      if (errDetails.retryable && task.attemptCount < task.maxAttempts) {
        throw error;
      }
    }
  }

  async updateCampaignStats(campaignId: string): Promise<void> {
    const campaign = await SkuPostingCampaign.findById(campaignId);
    if (!campaign) return;

    const [totalTasks, completedTasks, failedTasks, pendingTasks, processingTasks] = await Promise.all([
      SkuPublishTask.countDocuments({ campaignId }),
      SkuPublishTask.countDocuments({ campaignId, status: 'success' }),
      SkuPublishTask.countDocuments({ campaignId, status: 'failed' }),
      SkuPublishTask.countDocuments({ campaignId, status: { $in: ['pending', 'queued', 'paused'] } }),
      SkuPublishTask.countDocuments({ campaignId, status: 'processing' }),
    ]);

    campaign.stats = {
      ...campaign.stats,
      totalTasks,
      completedTasks,
      failedTasks,
      pendingTasks,
      processingTasks,
    };

    if (totalTasks > 0 && completedTasks + failedTasks === totalTasks) {
      campaign.status = 'completed';
    } else if (campaign.status === 'draft' || campaign.status === 'scheduled') {
      if (processingTasks > 0 || completedTasks > 0) {
        campaign.status = 'publishing';
      }
    }

    await campaign.save();

    socketManager.emitToUser(campaign.userId.toString(), 'sku:campaign:stats', {
      campaignId: campaign._id,
      stats: campaign.stats,
      status: campaign.status,
    });
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}

export const skuPublisherWorker = new SkuPublisherWorker();
