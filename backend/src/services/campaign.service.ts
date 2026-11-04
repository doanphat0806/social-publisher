import mongoose, { Types } from 'mongoose';
import { Campaign, ICampaign, Post, PublishTask, FacebookPage, MediaAsset } from '../models/index.js';
import { socketManager } from '../sockets/socketManager.js';
import { logger } from '../utils/logger.js';

export interface CampaignPreviewResult {
  totalImages: number;
  imagesPerPost: number;
  totalPosts: number;
  pageCount: number;
  totalPublishes: number;
  posts: Array<{
    postNumber: number;
    imageCount: number;
    schedules: Array<{
      pageId: string;
      pageName?: string;
      scheduledAt: Date;
    }>;
  }>;
}

export class CampaignService {
  /**
   * Generates a preview of the campaign distribution and schedules
   */
  async generatePreview(params: {
    totalImages: number;
    imagesPerPost: number;
    pageIds: string[];
    intervalMinutes: number;
    startAt: Date;
  }): Promise<CampaignPreviewResult> {
    const { totalImages, imagesPerPost, pageIds, intervalMinutes, startAt } = params;
    const totalPosts = Math.ceil(totalImages / imagesPerPost);
    const pages = mongoose.connection.readyState === 1
      ? await FacebookPage.find({ pageId: { $in: pageIds } })
      : [];
    const pageMap = new Map(pages.map(p => [p.pageId, p.pageName]));

    const posts: CampaignPreviewResult['posts'] = [];

    for (let i = 0; i < totalPosts; i++) {
      const isLast = i === totalPosts - 1;
      const remainder = totalImages % imagesPerPost;
      const imageCount = isLast && remainder !== 0 ? remainder : imagesPerPost;

      const schedules = pageIds.map(pageId => {
        const scheduledTime = new Date(startAt.getTime() + i * intervalMinutes * 60 * 1000);
        return {
          pageId,
          pageName: pageMap.get(pageId) || pageId,
          scheduledAt: scheduledTime,
        };
      });

      posts.push({
        postNumber: i + 1,
        imageCount,
        schedules,
      });
    }

    return {
      totalImages,
      imagesPerPost,
      totalPosts,
      pageCount: pageIds.length,
      totalPublishes: totalPosts * pageIds.length,
      posts,
    };
  }

  /**
   * Creates a full campaign with Posts and PublishTasks
   */
  async createCampaign(params: {
    userId: string;
    name: string;
    description?: string;
    caption: string;
    imagesPerPost: number;
    pageIds: string[];
    intervalMinutes: number;
    startAt: Date;
    timezone: string;
    distributionMode?: 'all_pages' | 'round_robin';
    mediaIds: string[];
  }): Promise<ICampaign> {
    const {
      userId,
      name,
      description,
      caption,
      imagesPerPost,
      pageIds,
      intervalMinutes,
      startAt,
      timezone,
      distributionMode = 'all_pages',
      mediaIds,
    } = params;

    const totalImages = mediaIds.length;
    const totalPosts = totalImages > 0 ? Math.ceil(totalImages / imagesPerPost) : 0;
    const totalPublishes = totalPosts * pageIds.length;

    // 1. Create Campaign
    const campaign = new Campaign({
      userId: new Types.ObjectId(userId),
      name,
      description,
      caption,
      totalImages,
      imagesPerPost,
      totalPosts,
      pageIds,
      intervalMinutes,
      startAt,
      timezone,
      distributionMode,
      status: 'draft',
      stats: {
        totalPosts,
        totalPublishes,
        successfulPublishes: 0,
        failedPublishes: 0,
        pendingPublishes: totalPublishes,
        processingPublishes: 0,
      },
    });

    await campaign.save();

    // Attach campaignId to media assets
    if (mediaIds.length > 0) {
      await MediaAsset.updateMany(
        { _id: { $in: mediaIds.map(id => new Types.ObjectId(id)) } },
        { $set: { campaignId: campaign._id } }
      );
    }

    // Find FacebookPage refs to link
    const fbPages = await FacebookPage.find({ pageId: { $in: pageIds }, userId: new Types.ObjectId(userId) });
    const pageRefMap = new Map(fbPages.map(p => [p.pageId, p._id]));

    // 2. Create Post objects and PublishTasks
    for (let postIdx = 0; postIdx < totalPosts; postIdx++) {
      const startMediaIdx = postIdx * imagesPerPost;
      const endMediaIdx = Math.min(startMediaIdx + imagesPerPost, totalImages);
      const postMediaIds = mediaIds.slice(startMediaIdx, endMediaIdx).map(id => new Types.ObjectId(id));

      const post = new Post({
        campaignId: campaign._id,
        postNumber: postIdx + 1,
        caption: caption,
        mediaIds: postMediaIds,
        totalImages: postMediaIds.length,
        status: 'pending',
      });
      await post.save();

      // For each Fanpage, create independent PublishTask
      for (const pageId of pageIds) {
        const scheduledTime = new Date(startAt.getTime() + postIdx * intervalMinutes * 60 * 1000);
        const task = new PublishTask({
          campaignId: campaign._id,
          postId: post._id,
          pageId,
          facebookPageRef: pageRefMap.get(pageId),
          scheduledAt: scheduledTime,
          status: 'pending',
          attemptCount: 0,
          maxAttempts: 5,
        });
        await task.save();
      }
    }

    socketManager.emitToUser(userId, 'campaign:created', { campaignId: campaign._id, name: campaign.name });
    logger.info(`Campaign created: ${campaign._id} with ${totalPosts} posts and ${totalPublishes} publish tasks`);

    return campaign;
  }

  /**
   * Start / Launch Campaign
   */
  async startCampaign(campaignId: string, userId: string): Promise<ICampaign> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) {
      throw new Error('Chiến dịch không tồn tại');
    }

    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      throw new Error(`Không thể khởi chạy chiến dịch đang ở trạng thái ${campaign.status}`);
    }

    const now = new Date();
    // If startAt is in the past, update tasks schedules proportionally from now
    if (campaign.startAt < now) {
      const diffMs = now.getTime() - campaign.startAt.getTime();
      campaign.startAt = now;
      await PublishTask.updateMany(
        { campaignId: campaign._id, status: 'pending' },
        [
          {
            $set: {
              scheduledAt: { $add: ['$scheduledAt', diffMs] },
            },
          },
        ]
      );
    }

    campaign.status = 'scheduled';
    await campaign.save();

    socketManager.emitToUser(userId, 'campaign:started', { campaignId: campaign._id, status: campaign.status });
    return campaign;
  }

  /**
   * Pause Campaign
   */
  async pauseCampaign(campaignId: string, userId: string): Promise<ICampaign> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) {
      throw new Error('Chiến dịch không tồn tại');
    }

    campaign.status = 'paused';
    await campaign.save();

    // Mark pending tasks as paused
    await PublishTask.updateMany(
      { campaignId: campaign._id, status: 'pending' },
      { $set: { status: 'paused' } }
    );

    socketManager.emitToUser(userId, 'campaign:paused', { campaignId: campaign._id });
    return campaign;
  }

  /**
   * Resume Campaign
   */
  async resumeCampaign(campaignId: string, userId: string): Promise<ICampaign> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) {
      throw new Error('Chiến dịch không tồn tại');
    }

    if (campaign.status !== 'paused') {
      throw new Error('Chiến dịch chưa bị tạm dừng');
    }

    campaign.status = 'scheduled';
    await campaign.save();

    // Restore paused tasks to pending
    await PublishTask.updateMany(
      { campaignId: campaign._id, status: 'paused' },
      { $set: { status: 'pending' } }
    );

    socketManager.emitToUser(userId, 'campaign:resumed', { campaignId: campaign._id });
    return campaign;
  }

  /**
   * Cancel Campaign
   */
  async cancelCampaign(campaignId: string, userId: string): Promise<ICampaign> {
    const campaign = await Campaign.findOne({ _id: campaignId, userId });
    if (!campaign) {
      throw new Error('Chiến dịch không tồn tại');
    }

    campaign.status = 'cancelled';
    await campaign.save();

    // Cancel all pending/paused/queued tasks (leave success and already running alone)
    await PublishTask.updateMany(
      { campaignId: campaign._id, status: { $in: ['pending', 'paused', 'queued'] } },
      { $set: { status: 'cancelled' } }
    );

    socketManager.emitToUser(userId, 'campaign:cancelled', { campaignId: campaign._id });
    return campaign;
  }
}

export const campaignService = new CampaignService();
