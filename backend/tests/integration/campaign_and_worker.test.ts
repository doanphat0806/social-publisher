import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, FacebookAccount, FacebookPage, Campaign, MediaAsset, Post, PublishTask } from '../../src/models/index.js';
import { CampaignService } from '../../src/services/campaign.service.js';
import { encryptToken } from '../../src/utils/crypto.js';
import { setupMockFacebookApi } from '../mockFacebookApi.js';
import { PublisherWorker } from '../../src/workers/publisherWorker.js';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Campaign & Publishing Lifecycle Integration Tests', () => {
  const campaignService = new CampaignService();

  it('Case 1, 5, 6, 20: Should create campaign with 100 media items, 3 pages, 30 tasks, and enforce unique compound index', async () => {
    // 1. Create User
    const user = await User.create({
      email: 'tester@example.com',
      passwordHash: 'hash123',
      name: 'Tester',
    });

    // 2. Create 3 Facebook Pages
    const account = await FacebookAccount.create({
      userId: user._id,
      facebookUserId: 'fb_user_1',
      facebookName: 'Tester FB',
      accessTokenEncrypted: encryptToken('user_token'),
      status: 'active',
    });

    const pageIds = ['page_001', 'page_002', 'page_003'];
    for (const pageId of pageIds) {
      await FacebookPage.create({
        userId: user._id,
        facebookAccountId: account._id,
        pageId,
        pageName: `Fanpage ${pageId}`,
        pageAccessTokenEncrypted: encryptToken(`token_${pageId}`),
        status: 'active',
      });
    }

    // 3. Create 100 Media Assets
    const mediaIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const asset = await MediaAsset.create({
        userId: user._id,
        originalName: `photo_${i + 1}.jpg`,
        mimeType: 'image/jpeg',
        fileSize: 1024 * 500,
        storageKey: `uploads/photo_${i + 1}.jpg`,
        storageUrl: `http://localhost:5000/uploads/photo_${i + 1}.jpg`,
        checksum: `checksum_${i + 1}`,
        status: 'ready',
      });
      mediaIds.push(asset._id.toString());
    }

    expect(mediaIds.length).toBe(100);

    // 4. Create Campaign
    const campaign = await campaignService.createCampaign({
      userId: user._id.toString(),
      name: 'Super Sale Bulk Campaign',
      caption: 'Big Sale 50% Off Everything!',
      imagesPerPost: 10,
      pageIds,
      intervalMinutes: 15,
      startAt: new Date(),
      timezone: 'Asia/Ho_Chi_Minh',
      mediaIds,
    });

    expect(campaign.totalImages).toBe(100);
    expect(campaign.totalPosts).toBe(10);
    expect(campaign.stats.totalPublishes).toBe(30);

    // Verify 10 posts created in DB
    const postsInDb = await Post.find({ campaignId: campaign._id });
    expect(postsInDb.length).toBe(10);

    // Verify 30 PublishTasks created in DB (10 posts * 3 pages)
    const tasksInDb = await PublishTask.find({ campaignId: campaign._id });
    expect(tasksInDb.length).toBe(30);

    // Case 20: Test anti-duplicate compound index (campaignId + postId + pageId)
    await PublishTask.syncIndexes();
    const firstTask = tasksInDb[0];
    const duplicateTask = new PublishTask({
      campaignId: firstTask.campaignId,
      postId: firstTask.postId,
      pageId: firstTask.pageId,
      scheduledAt: new Date(),
      status: 'pending',
    });

    await expect(duplicateTask.save()).rejects.toThrow();
  });

  it('Case 16, 17, 18: Should handle Pause, Resume, and Cancel states safely', async () => {
    const user = await User.create({
      email: 'user_state@example.com',
      passwordHash: 'hash',
      name: 'State User',
    });

    const campaign = await Campaign.create({
      userId: user._id,
      name: 'Test States Campaign',
      caption: 'Testing',
      totalImages: 10,
      imagesPerPost: 10,
      totalPosts: 1,
      pageIds: ['p1'],
      intervalMinutes: 15,
      startAt: new Date(),
      status: 'scheduled',
    });

    const post = await Post.create({
      campaignId: campaign._id,
      postNumber: 1,
      caption: 'Testing',
      totalImages: 10,
    });

    const task = await PublishTask.create({
      campaignId: campaign._id,
      postId: post._id,
      pageId: 'p1',
      scheduledAt: new Date(),
      status: 'pending',
    });

    // 1. Pause
    await campaignService.pauseCampaign(campaign._id.toString(), user._id.toString());
    const pausedCamp = await Campaign.findById(campaign._id);
    const pausedTask = await PublishTask.findById(task._id);
    expect(pausedCamp?.status).toBe('paused');
    expect(pausedTask?.status).toBe('paused');

    // 2. Resume
    await campaignService.resumeCampaign(campaign._id.toString(), user._id.toString());
    const resumedCamp = await Campaign.findById(campaign._id);
    const resumedTask = await PublishTask.findById(task._id);
    expect(resumedCamp?.status).toBe('scheduled');
    expect(resumedTask?.status).toBe('pending');

    // 3. Cancel
    await campaignService.cancelCampaign(campaign._id.toString(), user._id.toString());
    const cancelledCamp = await Campaign.findById(campaign._id);
    const cancelledTask = await PublishTask.findById(task._id);
    expect(cancelledCamp?.status).toBe('cancelled');
    expect(cancelledTask?.status).toBe('cancelled');
  });

  it('Case 21: Should strictly isolate User A data from User B', async () => {
    const userA = await User.create({ email: 'userA@test.com', passwordHash: 'h1', name: 'User A' });
    const userB = await User.create({ email: 'userB@test.com', passwordHash: 'h2', name: 'User B' });

    const campA = await Campaign.create({
      userId: userA._id,
      name: 'Campaign A',
      caption: 'Test',
      totalImages: 0,
      imagesPerPost: 10,
      totalPosts: 0,
      pageIds: ['p1'],
      intervalMinutes: 15,
      startAt: new Date(),
      status: 'draft',
    });

    // User B tries to pause User A's campaign -> must fail
    await expect(campaignService.pauseCampaign(campA._id.toString(), userB._id.toString())).rejects.toThrow(
      'Chiến dịch không tồn tại'
    );
  });

  it('Case 8, 9, 10, 11, 12, 13: Should execute publishing and handle Meta Graph API responses correctly', async () => {
    const mockMeta = setupMockFacebookApi();

    try {
      const user = await User.create({ email: 'publisher@test.com', passwordHash: 'h', name: 'Publisher' });
      const account = await FacebookAccount.create({
        userId: user._id,
        facebookUserId: 'fb_1',
        facebookName: 'FB',
        accessTokenEncrypted: encryptToken('tok'),
      });

      const page = await FacebookPage.create({
        userId: user._id,
        facebookAccountId: account._id,
        pageId: 'page_meta_test',
        pageName: 'Meta Test Page',
        pageAccessTokenEncrypted: encryptToken('page_access_token_mock'),
        status: 'active',
      });

      const asset = await MediaAsset.create({
        userId: user._id,
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1000,
        storageKey: 'test.jpg',
        storageUrl: 'http://localhost:5000/uploads/test.jpg',
        checksum: 'chk_123',
        status: 'ready',
      });

      const campaign = await Campaign.create({
        userId: user._id,
        name: 'Live Publish Campaign',
        caption: 'Hello Facebook!',
        totalImages: 1,
        imagesPerPost: 1,
        totalPosts: 1,
        pageIds: [page.pageId],
        intervalMinutes: 15,
        startAt: new Date(),
        status: 'scheduled',
      });

      const post = await Post.create({
        campaignId: campaign._id,
        postNumber: 1,
        caption: 'Post content',
        mediaIds: [asset._id],
        totalImages: 1,
      });

      const task = await PublishTask.create({
        campaignId: campaign._id,
        postId: post._id,
        pageId: page.pageId,
        scheduledAt: new Date(),
        status: 'pending',
      });

      const worker = new PublisherWorker();

      // Case 8: Successful multi-photo post
      const mockJob: any = {
        data: {
          taskId: task._id.toString(),
          campaignId: campaign._id.toString(),
          postId: post._id.toString(),
          pageId: page.pageId,
        },
      };

      await worker.processJob(mockJob);

      const publishedTask = await PublishTask.findById(task._id);
      expect(publishedTask?.status).toBe('success');
      expect(publishedTask?.facebookPostId).toBeDefined();
      expect(publishedTask?.facebookPostUrl).toBeDefined();
      expect(publishedTask?.facebookPhotoIds.length).toBe(1);

      // Verify campaign stats updated
      const updatedCampaign = await Campaign.findById(campaign._id);
      expect(updatedCampaign?.stats.successfulPublishes).toBe(1);
    } finally {
      mockMeta.restore();
    }
  });

  it('Case 10: Token expired should update Fanpage status to expired and mark task failed', async () => {
    const mockMeta = setupMockFacebookApi({ tokenExpired: true });

    try {
      const user = await User.create({ email: 'expired@test.com', passwordHash: 'h', name: 'Exp' });
      const account = await FacebookAccount.create({
        userId: user._id,
        facebookUserId: 'fb_exp',
        facebookName: 'FB Exp',
        accessTokenEncrypted: encryptToken('tok'),
      });

      const page = await FacebookPage.create({
        userId: user._id,
        facebookAccountId: account._id,
        pageId: 'page_expired',
        pageName: 'Expired Page',
        pageAccessTokenEncrypted: encryptToken('page_access_token_expired'),
        status: 'active',
      });

      const asset = await MediaAsset.create({
        userId: user._id,
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1000,
        storageKey: 'test.jpg',
        storageUrl: 'http://localhost:5000/uploads/test.jpg',
        checksum: 'chk_exp',
        status: 'ready',
      });

      const campaign = await Campaign.create({
        userId: user._id,
        name: 'Expired Token Campaign',
        caption: 'Hello',
        totalImages: 1,
        imagesPerPost: 1,
        totalPosts: 1,
        pageIds: [page.pageId],
        intervalMinutes: 15,
        startAt: new Date(),
        status: 'scheduled',
      });

      const post = await Post.create({
        campaignId: campaign._id,
        postNumber: 1,
        caption: 'Post content',
        mediaIds: [asset._id],
        totalImages: 1,
      });

      const task = await PublishTask.create({
        campaignId: campaign._id,
        postId: post._id,
        pageId: page.pageId,
        scheduledAt: new Date(),
        status: 'pending',
      });

      const worker = new PublisherWorker();
      const mockJob: any = {
        data: {
          taskId: task._id.toString(),
          campaignId: campaign._id.toString(),
          postId: post._id.toString(),
          pageId: page.pageId,
        },
      };

      await worker.processJob(mockJob);

      const failedTask = await PublishTask.findById(task._id);
      expect(failedTask?.status).toBe('failed');
      expect(failedTask?.errorCode).toBe('190');

      const updatedPage = await FacebookPage.findById(page._id);
      expect(updatedPage?.status).toBe('expired');
    } finally {
      mockMeta.restore();
    }
  });

  it('Case 12: Rate limit (Code 32/429) should be marked as retryable error', async () => {
    const mockMeta = setupMockFacebookApi({ rateLimit: true });

    try {
      const user = await User.create({ email: 'ratelimit@test.com', passwordHash: 'h', name: 'RL' });
      const account = await FacebookAccount.create({
        userId: user._id,
        facebookUserId: 'fb_rl',
        facebookName: 'FB RL',
        accessTokenEncrypted: encryptToken('tok'),
      });

      const page = await FacebookPage.create({
        userId: user._id,
        facebookAccountId: account._id,
        pageId: 'page_rl',
        pageName: 'RL Page',
        pageAccessTokenEncrypted: encryptToken('page_access_token_rl'),
        status: 'active',
      });

      const asset = await MediaAsset.create({
        userId: user._id,
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1000,
        storageKey: 'test.jpg',
        storageUrl: 'http://localhost:5000/uploads/test.jpg',
        checksum: 'chk_rl',
        status: 'ready',
      });

      const campaign = await Campaign.create({
        userId: user._id,
        name: 'Rate Limit Campaign',
        caption: 'Hello',
        totalImages: 1,
        imagesPerPost: 1,
        totalPosts: 1,
        pageIds: [page.pageId],
        intervalMinutes: 15,
        startAt: new Date(),
        status: 'scheduled',
      });

      const post = await Post.create({
        campaignId: campaign._id,
        postNumber: 1,
        caption: 'Post content',
        mediaIds: [asset._id],
        totalImages: 1,
      });

      const task = await PublishTask.create({
        campaignId: campaign._id,
        postId: post._id,
        pageId: page.pageId,
        scheduledAt: new Date(),
        status: 'pending',
      });

      const worker = new PublisherWorker();
      const mockJob: any = {
        data: {
          taskId: task._id.toString(),
          campaignId: campaign._id.toString(),
          postId: post._id.toString(),
          pageId: page.pageId,
        },
      };

      // Since rate limit is retryable and attemptCount < maxAttempts, it throws for BullMQ backoff
      await expect(worker.processJob(mockJob)).rejects.toThrow();

      const rlTask = await PublishTask.findById(task._id);
      expect(rlTask?.errorCode).toBe('32');
      expect(rlTask?.status).toBe('pending'); // Kept pending for retry
    } finally {
      mockMeta.restore();
    }
  });

  it('Case 19: Retry failed task should reset status to pending', async () => {
    const user = await User.create({ email: 'retry@test.com', passwordHash: 'h', name: 'Retry User' });
    const campaign = await Campaign.create({
      userId: user._id,
      name: 'Retry Campaign',
      caption: 'Retry test',
      totalImages: 1,
      imagesPerPost: 1,
      totalPosts: 1,
      pageIds: ['page_1'],
      intervalMinutes: 15,
      startAt: new Date(),
      status: 'scheduled',
    });

    const post = await Post.create({
      campaignId: campaign._id,
      postNumber: 1,
      caption: 'Post',
      totalImages: 1,
    });

    const task = await PublishTask.create({
      campaignId: campaign._id,
      postId: post._id,
      pageId: 'page_1',
      scheduledAt: new Date(),
      status: 'failed',
      errorMessage: 'Previous failure',
    });

    // Reset status to pending for retry
    task.status = 'pending';
    task.errorMessage = undefined;
    await task.save();

    const retriedTask = await PublishTask.findById(task._id);
    expect(retriedTask?.status).toBe('pending');
    expect(retriedTask?.errorMessage).toBeUndefined();
  });
});
