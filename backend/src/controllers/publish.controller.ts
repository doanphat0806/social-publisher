import { Request, Response, NextFunction } from 'express';
import { PublishTask, Campaign, FacebookPage, PublishLog, Post } from '../models/index.js';
import { queueManager } from '../queues/queueManager.js';
import { socketManager } from '../sockets/socketManager.js';

export class PublishController {
  /**
   * GET /publish/tasks
   */
  async getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const { campaignId, pageId, status, startDate, endDate } = req.query;

      // Filter by campaigns belonging to this user
      const userCampaigns = await Campaign.find({ userId }).select('_id');
      const campaignIds = userCampaigns.map(c => c._id);

      const query: any = { campaignId: { $in: campaignIds } };
      if (campaignId) query.campaignId = campaignId;
      if (pageId) query.pageId = pageId;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.scheduledAt = {};
        if (startDate) query.scheduledAt.$gte = new Date(startDate as string);
        if (endDate) query.scheduledAt.$lte = new Date(endDate as string);
      }

      const [total, tasks] = await Promise.all([
        PublishTask.countDocuments(query),
        PublishTask.find(query)
          .populate('campaignId', 'name')
          .populate('postId', 'postNumber caption totalImages')
          .populate('facebookPageRef', 'pageName avatarUrl')
          .sort({ scheduledAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ]);

      res.json({
        success: true,
        data: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          tasks,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /publish/tasks/:id
   */
  async getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await PublishTask.findById(req.params.id)
        .populate('campaignId')
        .populate({
          path: 'postId',
          populate: { path: 'mediaIds' },
        })
        .populate('facebookPageRef');

      if (!task) {
        res.status(404).json({ success: false, message: 'Nhiệm vụ đăng bài không tồn tại' });
        return;
      }

      const logs = await PublishLog.find({ taskId: task._id }).sort({ createdAt: -1 });

      res.json({ success: true, data: { task, logs } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /publish/tasks/:id/retry
   */
  async retryTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await PublishTask.findById(req.params.id);
      if (!task) {
        res.status(404).json({ success: false, message: 'Nhiệm vụ đăng bài không tồn tại' });
        return;
      }

      if (task.status === 'success') {
        res.status(400).json({ success: false, message: 'Bài viết này đã được đăng thành công, không thể đăng lại để tránh trùng lặp' });
        return;
      }

      // Reset task status to pending so scheduler / queue picks it up immediately
      task.status = 'pending';
      task.scheduledAt = new Date(); // Schedule now
      task.errorMessage = undefined;
      task.errorCode = undefined;
      await task.save();

      // Enqueue to BullMQ
      const queue = queueManager.getPublishQueue();
      await queue.add(
        'publish-task',
        {
          taskId: task._id.toString(),
          campaignId: task.campaignId.toString(),
          postId: task.postId.toString(),
          pageId: task.pageId,
        },
        {
          jobId: `${task._id.toString()}-retry-${Date.now()}`,
        }
      );

      res.json({ success: true, message: 'Đã gửi yêu cầu đăng lại vào hàng đợi', data: { task } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /publish/tasks/:id/cancel
   */
  async cancelTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const task = await PublishTask.findById(req.params.id);
      if (!task) {
        res.status(404).json({ success: false, message: 'Nhiệm vụ đăng bài không tồn tại' });
        return;
      }

      if (task.status === 'success') {
        res.status(400).json({ success: false, message: 'Không thể hủy bài viết đã đăng thành công' });
        return;
      }

      if (task.status === 'processing') {
        res.status(400).json({ success: false, message: 'Bài viết đang trong quá trình gửi lên Facebook, không thể hủy ngay' });
        return;
      }

      task.status = 'cancelled';
      await task.save();

      res.json({ success: true, message: 'Đã hủy nhiệm vụ đăng bài', data: { task } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /publish/campaigns/:id/stats
   */
  async getCampaignStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const campaign = await Campaign.findById(req.params.id);
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      const tasks = await PublishTask.find({ campaignId: campaign._id });
      const stats = {
        totalTasks: tasks.length,
        success: tasks.filter(t => t.status === 'success').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        pending: tasks.filter(t => t.status === 'pending').length,
        queued: tasks.filter(t => t.status === 'queued').length,
        processing: tasks.filter(t => t.status === 'processing').length,
        paused: tasks.filter(t => t.status === 'paused').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
      };

      res.json({ success: true, data: { stats } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /publish/campaigns/:id/logs
   */
  async getCampaignLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tasks = await PublishTask.find({ campaignId: req.params.id }).select('_id');
      const taskIds = tasks.map(t => t._id);

      const logs = await PublishLog.find({ taskId: { $in: taskIds } })
        .populate('taskId')
        .sort({ createdAt: -1 })
        .limit(100);

      res.json({ success: true, data: { logs } });
    } catch (error) {
      next(error);
    }
  }
}

export const publishController = new PublishController();

