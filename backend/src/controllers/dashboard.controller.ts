import { Request, Response, NextFunction } from 'express';
import { FacebookPage, Campaign, MediaAsset, Post, PublishTask } from '../models/index.js';

export class DashboardController {
  /**
   * GET /dashboard/overview
   */
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;

      const userCampaigns = await Campaign.find({ userId }).select('_id');
      const campaignIds = userCampaigns.map(c => c._id);

      const [
        totalFanpages,
        totalCampaigns,
        totalImages,
        totalPosts,
        tasksStats,
      ] = await Promise.all([
        FacebookPage.countDocuments({ userId, status: 'active' }),
        Campaign.countDocuments({ userId }),
        MediaAsset.countDocuments({ userId, status: 'ready' }),
        Post.countDocuments({ campaignId: { $in: campaignIds } }),
        PublishTask.aggregate([
          { $match: { campaignId: { $in: campaignIds } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
      ]);

      const statsMap: Record<string, number> = {};
      tasksStats.forEach(item => {
        statsMap[item._id] = item.count;
      });

      const totalPublishes = Object.values(statsMap).reduce((a, b) => a + b, 0);

      res.json({
        success: true,
        data: {
          totalFanpages,
          totalCampaigns,
          totalImages,
          totalPosts,
          totalPublishes,
          successfulPublishes: statsMap['success'] || 0,
          pendingPublishes: (statsMap['pending'] || 0) + (statsMap['queued'] || 0),
          processingPublishes: statsMap['processing'] || 0,
          failedPublishes: statsMap['failed'] || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /dashboard/publishing-chart
   */
  async getPublishingChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const userCampaigns = await Campaign.find({ userId }).select('_id');
      const campaignIds = userCampaigns.map(c => c._id);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const dailyStats = await PublishTask.aggregate([
        {
          $match: {
            campaignId: { $in: campaignIds },
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' } },
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
      ]);

      // Page breakdown
      const pageStats = await PublishTask.aggregate([
        {
          $match: {
            campaignId: { $in: campaignIds },
          },
        },
        {
          $group: {
            _id: { pageId: '$pageId', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]);

      res.json({
        success: true,
        data: {
          dailyStats,
          pageStats,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /dashboard/recent-activities
   */
  async getRecentActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const userCampaigns = await Campaign.find({ userId }).select('_id');
      const campaignIds = userCampaigns.map(c => c._id);

      const recentTasks = await PublishTask.find({ campaignId: { $in: campaignIds } })
        .populate('campaignId', 'name')
        .populate('postId', 'postNumber caption totalImages')
        .populate('facebookPageRef', 'pageName avatarUrl')
        .sort({ updatedAt: -1 })
        .limit(10);

      res.json({ success: true, data: { activities: recentTasks } });
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();

