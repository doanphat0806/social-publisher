import { Request, Response, NextFunction } from 'express';
import { Campaign, Post, PublishTask, FacebookPage } from '../models/index.js';
import { campaignService } from '../services/campaign.service.js';

export class CampaignController {
  /**
   * POST /campaigns/preview
   */
  async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { totalImages, imagesPerPost, pageIds, intervalMinutes, startAt } = req.body;
      const result = await campaignService.generatePreview({
        totalImages,
        imagesPerPost,
        pageIds,
        intervalMinutes,
        startAt: new Date(startAt),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /campaigns
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const campaign = await campaignService.createCampaign({
        userId,
        ...req.body,
        startAt: new Date(req.body.startAt),
      });

      res.status(201).json({
        success: true,
        message: 'Tạo chiến dịch thành công',
        data: { campaign },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /campaigns
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
      const status = req.query.status as string;
      const search = req.query.search as string;

      const query: any = { userId };
      if (status) query.status = status;
      if (search) query.name = { $regex: search, $options: 'i' };

      const [total, campaigns] = await Promise.all([
        Campaign.countDocuments(query),
        Campaign.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
      ]);

      res.json({
        success: true,
        data: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          campaigns,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /campaigns/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await Campaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      // Fetch pages for details
      const pages = await FacebookPage.find({ pageId: { $in: campaign.pageIds }, userId })
        .select('pageId pageName avatarUrl status');

      res.json({
        success: true,
        data: {
          campaign,
          pages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /campaigns/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await Campaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      if (campaign.status !== 'draft') {
        res.status(400).json({ success: false, message: 'Chỉ có thể chỉnh sửa chiến dịch ở trạng thái bản nháp' });
        return;
      }

      Object.assign(campaign, req.body);
      await campaign.save();

      res.json({ success: true, message: 'Cập nhật chiến dịch thành công', data: { campaign } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /campaigns/:id
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await Campaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      if (campaign.status === 'running') {
        res.status(400).json({ success: false, message: 'Không thể xóa chiến dịch đang chạy. Vui lòng dừng hoặc hủy trước' });
        return;
      }

      await PublishTask.deleteMany({ campaignId: campaign._id });
      await Post.deleteMany({ campaignId: campaign._id });
      await campaign.deleteOne();

      res.json({ success: true, message: 'Đã xóa chiến dịch thành công' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /campaigns/:id/start
   */
  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const campaign = await campaignService.startCampaign(String(req.params.id), userId);
      res.json({ success: true, message: 'Đã kích hoạt chạy chiến dịch thành công', data: { campaign } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /campaigns/:id/pause
   */
  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const campaign = await campaignService.pauseCampaign(String(req.params.id), userId);
      res.json({ success: true, message: 'Đã tạm dừng chiến dịch', data: { campaign } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /campaigns/:id/resume
   */
  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const campaign = await campaignService.resumeCampaign(String(req.params.id), userId);
      res.json({ success: true, message: 'Đã tiếp tục chạy chiến dịch', data: { campaign } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /campaigns/:id/cancel
   */
  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const campaign = await campaignService.cancelCampaign(String(req.params.id), userId);
      res.json({ success: true, message: 'Đã hủy chiến dịch thành công', data: { campaign } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

export const campaignController = new CampaignController();
