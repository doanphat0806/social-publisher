import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import {
  SkuPostingCampaign,
  SkuProduct,
  SkuPublishTask,
  FacebookPage,
  MediaAsset,
  PublishLog,
} from '../models/index.js';
import { skuGroupingService } from '../services/skuGrouping.service.js';
import { mediaStorageService } from '../services/mediaStorage.service.js';
import { env } from '../config/env.js';

export class SkuPostingController {
  /**
   * POST /api/v1/sku-posting/scan-images
   * Upload or scan images and group by SKU code
   */
  async scanImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const imagesPerPost = parseInt(req.body.imagesPerPost, 10) || 4;
      const customRegex = req.body.customRegex as string | undefined;

      const files = req.files as Express.Multer.File[];
      const baseUrl = `http://localhost:${env.PORT}`;
      const fileInfos: any[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const checksum = mediaStorageService.calculateChecksum(file.buffer);

          let asset = await MediaAsset.findOne({ userId, checksum, status: 'ready' });
          if (!asset) {
            const storageKey = mediaStorageService.generateStorageKey(userId, file.originalname);
            const publicUrl = await mediaStorageService.saveLocalFile(storageKey, file.buffer);

            asset = new MediaAsset({
              userId: new Types.ObjectId(userId),
              originalName: file.originalname,
              mimeType: file.mimetype,
              fileSize: file.size,
              storageKey,
              storageUrl: publicUrl,
              checksum,
              status: 'ready',
            });
            await asset.save();
          }

          fileInfos.push({
            mediaAssetId: asset._id.toString(),
            fileName: asset.originalName,
            originalName: asset.originalName,
            url: mediaStorageService.getFileUrl(asset.storageKey, baseUrl),
            size: asset.fileSize,
          });
        }
      } else if (req.body.existingAssetIds && Array.isArray(req.body.existingAssetIds)) {
        // Handle pre-uploaded asset IDs from media library
        const assets = await MediaAsset.find({
          _id: { $in: req.body.existingAssetIds },
          userId,
        });

        for (const asset of assets) {
          fileInfos.push({
            mediaAssetId: asset._id.toString(),
            fileName: asset.originalName,
            originalName: asset.originalName,
            url: mediaStorageService.getFileUrl(asset.storageKey, baseUrl),
            size: asset.fileSize,
          });
        }
      } else {
        res.status(400).json({ success: false, message: 'Vui lòng tải lên ít nhất một ảnh sản phẩm' });
        return;
      }

      const groupsMap = skuGroupingService.groupMediaBySku(fileInfos, imagesPerPost, customRegex);
      const groups = Array.from(groupsMap.values());

      let readyCount = 0;
      let missingCount = 0;
      let excessCount = 0;
      let unclassifiedCount = 0;

      for (const g of groups) {
        if (g.productCode === 'Chưa phân loại') {
          unclassifiedCount += g.imageCount;
        } else if (g.status === 'ready') {
          readyCount++;
        } else if (g.status === 'missing_images') {
          missingCount++;
        } else if (g.status === 'excess_images') {
          excessCount++;
        }
      }

      res.json({
        success: true,
        data: {
          totalFiles: fileInfos.length,
          totalSkus: groups.length,
          readyCount,
          missingCount,
          excessCount,
          unclassifiedCount,
          groups,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/import-products
   * Merge Excel/CSV data with SKU image groups
   */
  async importProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { groups, excelRows, imagesPerPost } = req.body;

      if (!Array.isArray(excelRows)) {
        res.status(400).json({ success: false, message: 'Dữ liệu Excel/CSV không hợp lệ' });
        return;
      }

      const groupsMap = new Map();
      if (Array.isArray(groups)) {
        for (const g of groups) {
          groupsMap.set(g.productCode, g);
        }
      }

      const targetCount = parseInt(imagesPerPost, 10) || 4;
      const merged = skuGroupingService.matchExcelWithSku(groupsMap, excelRows, targetCount);

      res.json({
        success: true,
        data: {
          totalProducts: merged.length,
          products: merged,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/preview
   * Preview all posts before launching campaign
   */
  async previewCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        captionTemplate,
        priceUnit = 'K',
        showCodeLine = true,
        products,
        selectedPages,
        scheduleConfig,
      } = req.body;

      if (!Array.isArray(products) || products.length === 0) {
        res.status(400).json({ success: false, message: 'Chưa có sản phẩm nào để tạo preview' });
        return;
      }

      if (!Array.isArray(selectedPages) || selectedPages.length === 0) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một Fanpage' });
        return;
      }

      // Fetch Facebook page names
      const pages = await FacebookPage.find({ pageId: { $in: selectedPages } });
      const pageMap = new Map(pages.map((p) => [p.pageId, p]));

      // Generate schedule
      const scheduledTasks = skuGroupingService.generateSchedule(
        products,
        selectedPages,
        scheduleConfig || { mode: 'immediate', intervalMinutes: 15 }
      );

      const previewPosts = scheduledTasks.map((task) => {
        const prod = products.find((p: any) => p.productCode === task.productCode);
        const fbPage = pageMap.get(task.pageId);

        const caption =
          prod?.caption ||
          skuGroupingService.generateCaption(
            captionTemplate || `MS {product_code}\n\n👉 Sale cực sốc chỉ còn {price}K\n👉 Nhanh tay inbox ngay!`,
            task.productCode,
            prod?.price || 0,
            { unit: priceUnit, showCodeLine }
          );

        return {
          productCode: task.productCode,
          pageId: task.pageId,
          pageName: fbPage ? fbPage.pageName : `Page ${task.pageId}`,
          pageAvatar: fbPage?.avatarUrl,
          price: prod?.price || 0,
          formattedPrice: skuGroupingService.formatPrice(prod?.price || 0, priceUnit),
          caption,
          images: prod?.files || [],
          scheduledAt: task.scheduledAt,
        };
      });

      res.json({
        success: true,
        data: {
          totalPosts: previewPosts.length,
          previewPosts,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/campaigns
   * Create SKU Bulk Posting Campaign & Tasks
   */
  async createCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const {
        name,
        description,
        captionTemplate,
        priceUnit = 'K',
        showCodeLine = true,
        imagesPerPost = 4,
        selectedPages,
        scheduleConfig,
        products,
      } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'Tên chiến dịch không được để trống' });
        return;
      }

      if (!Array.isArray(selectedPages) || selectedPages.length === 0) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một Fanpage' });
        return;
      }

      if (!Array.isArray(products) || products.length === 0) {
        res.status(400).json({ success: false, message: 'Chiến dịch phải có ít nhất một mã sản phẩm' });
        return;
      }

      // 1. Create SkuPostingCampaign
      const campaign = new SkuPostingCampaign({
        userId,
        name: name.trim(),
        description,
        captionTemplate:
          captionTemplate ||
          `MS {product_code}\n\n👉 Sale cực sốc chỉ còn {price}K\n👉 Số lượng chỉ còn vài chiếc thôi ạ...\n\nNhanh tay inbox ngay cho shop ạ 👌👌👌`,
        priceUnit,
        showCodeLine,
        imagesPerPost,
        selectedPages,
        scheduleConfig: scheduleConfig || { mode: 'immediate', intervalMinutes: 15 },
        status: scheduleConfig?.mode === 'scheduled' ? 'scheduled' : 'publishing',
        stats: {
          totalProducts: products.length,
          totalImages: products.reduce((acc: number, p: any) => acc + (p.files?.length || 0), 0),
          totalTasks: products.length * selectedPages.length,
          completedTasks: 0,
          failedTasks: 0,
          pendingTasks: products.length * selectedPages.length,
          processingTasks: 0,
        },
      });
      await campaign.save();

      // 2. Create SkuProducts
      const savedProducts: any[] = [];
      for (let i = 0; i < products.length; i++) {
        const prod = products[i];
        const mediaAssetIds = (prod.files || [])
          .map((f: any) => f.mediaAssetId)
          .filter((id: any) => !!id)
          .map((id: any) => new Types.ObjectId(id));

        const customCaption =
          prod.caption ||
          skuGroupingService.generateCaption(campaign.captionTemplate, prod.productCode, prod.price || 0, {
            unit: priceUnit,
            showCodeLine,
          });

        const skuProduct = new SkuProduct({
          campaignId: campaign._id,
          userId,
          productCode: prod.productCode,
          price: prod.price || 0,
          mediaAssetIds,
          caption: customCaption,
          imageCount: mediaAssetIds.length,
          status:
            mediaAssetIds.length === imagesPerPost
              ? 'ready'
              : mediaAssetIds.length < imagesPerPost
              ? 'missing_images'
              : 'excess_images',
          orderIndex: i,
        });

        await skuProduct.save();
        savedProducts.push(skuProduct);
      }

      // 3. Generate Schedule and Create SkuPublishTasks
      const scheduledTasks = skuGroupingService.generateSchedule(
        savedProducts,
        selectedPages,
        campaign.scheduleConfig
      );

      const tasksToInsert = scheduledTasks.map((t) => {
        const product = savedProducts.find((p) => p.productCode === t.productCode)!;
        return {
          campaignId: campaign._id,
          userId,
          productId: product._id,
          productCode: product.productCode,
          pageId: t.pageId,
          caption: product.caption,
          mediaAssetIds: product.mediaAssetIds,
          scheduledAt: t.scheduledAt,
          status: 'pending',
          attemptCount: 0,
          maxAttempts: 5,
          idempotencyKey: `${campaign._id.toString()}_${product._id.toString()}_${t.pageId}`,
        };
      });

      await SkuPublishTask.insertMany(tasksToInsert);

      res.status(201).json({
        success: true,
        message: 'Tạo chiến dịch đăng bài theo mã thành công',
        data: {
          campaign,
          totalProducts: savedProducts.length,
          totalTasks: tasksToInsert.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sku-posting/campaigns
   */
  async getCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const status = req.query.status as string;

      const filter: any = { userId };
      if (status) filter.status = status;

      const [campaigns, total] = await Promise.all([
        SkuPostingCampaign.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        SkuPostingCampaign.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          campaigns,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sku-posting/campaigns/:id
   */
  async getCampaignById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await SkuPostingCampaign.findOne({
        _id: req.params.id,
        userId,
      });

      if (!campaign) {
        res.status(404).json({ success: false, message: 'Không tìm thấy chiến dịch' });
        return;
      }

      const products = await SkuProduct.find({ campaignId: campaign._id })
        .populate('mediaAssetIds')
        .sort({ orderIndex: 1 });

      const pages = await FacebookPage.find({ pageId: { $in: campaign.selectedPages } });

      res.json({
        success: true,
        data: {
          campaign,
          products,
          pages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/campaigns/:id/start
   */
  async startCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await SkuPostingCampaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      campaign.status = 'publishing';
      await campaign.save();

      res.json({ success: true, message: 'Chiến dịch đã bắt đầu chạy', data: { campaign } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/campaigns/:id/pause
   */
  async pauseCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await SkuPostingCampaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      campaign.status = 'paused';
      await campaign.save();

      await SkuPublishTask.updateMany(
        { campaignId: campaign._id, status: { $in: ['pending', 'queued'] } },
        { status: 'paused' }
      );

      res.json({ success: true, message: 'Chiến dịch đã tạm dừng', data: { campaign } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/campaigns/:id/resume
   */
  async resumeCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await SkuPostingCampaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      campaign.status = 'publishing';
      await campaign.save();

      await SkuPublishTask.updateMany(
        { campaignId: campaign._id, status: 'paused' },
        { status: 'pending' }
      );

      res.json({ success: true, message: 'Chiến dịch đã được tiếp tục', data: { campaign } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/campaigns/:id/cancel
   */
  async cancelCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaign = await SkuPostingCampaign.findOne({ _id: req.params.id, userId });
      if (!campaign) {
        res.status(404).json({ success: false, message: 'Chiến dịch không tồn tại' });
        return;
      }

      campaign.status = 'cancelled';
      await campaign.save();

      await SkuPublishTask.updateMany(
        { campaignId: campaign._id, status: { $in: ['pending', 'queued', 'paused'] } },
        { status: 'cancelled' }
      );

      res.json({ success: true, message: 'Chiến dịch đã hủy bỏ', data: { campaign } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sku-posting/campaigns/:id/tasks
   */
  async getCampaignTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaignId = req.params.id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string;
      const pageId = req.query.pageId as string;
      const productCode = req.query.productCode as string;

      const filter: any = { campaignId, userId };
      if (status) filter.status = status;
      if (pageId) filter.pageId = pageId;
      if (productCode) filter.productCode = new RegExp(productCode, 'i');

      const [tasks, total] = await Promise.all([
        SkuPublishTask.find(filter)
          .populate('productId')
          .populate('mediaAssetIds')
          .sort({ scheduledAt: 1 })
          .skip((page - 1) * limit)
          .limit(limit),
        SkuPublishTask.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          tasks,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/sku-posting/tasks/:id/retry
   */
  async retryTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const task = await SkuPublishTask.findOne({ _id: req.params.id, userId });
      if (!task) {
        res.status(404).json({ success: false, message: 'Không tìm thấy tác vụ' });
        return;
      }

      task.status = 'pending';
      task.attemptCount = 0;
      task.errorMessage = undefined;
      task.errorCode = undefined;
      task.scheduledAt = new Date(); // retry immediately
      await task.save();

      res.json({ success: true, message: 'Đã đặt lại trạng thái tác vụ để thử lại', data: { task } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sku-posting/campaigns/:id/logs
   */
  async getCampaignLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaignId = req.params.id;

      const tasks = await SkuPublishTask.find({ campaignId, userId }).select('_id');
      const taskIds = tasks.map((t) => t._id);

      const logs = await PublishLog.find({ taskId: { $in: taskIds } })
        .sort({ createdAt: -1 })
        .limit(100);

      res.json({
        success: true,
        data: { logs },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/sku-posting/campaigns/:id/export
   */
  async exportCampaignExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const campaignId = req.params.id;

      const tasks = await SkuPublishTask.find({ campaignId, userId })
        .populate('productId')
        .sort({ scheduledAt: 1 });

      const pages = await FacebookPage.find({});
      const pageMap = new Map(pages.map((p) => [p.pageId, p.pageName]));

      let csv = 'STT,Mã sản phẩm,Fanpage,Giá bán,Thời gian đăng,Trạng thái,Facebook Post ID,Link bài viết,Lỗi\n';

      tasks.forEach((t: any, index) => {
        const prod = t.productId as any;
        const pageName = pageMap.get(t.pageId) || t.pageId;
        const price = prod?.price || 0;
        const postUrl = t.facebookPostUrl || (t.facebookPostId ? `https://facebook.com/${t.facebookPostId}` : '');
        const error = (t.errorMessage || '').replace(/,/g, ' ');

        csv += `${index + 1},"${t.productCode}","${pageName}",${price},"${t.scheduledAt.toISOString()}","${t.status}","${t.facebookPostId || ''}","${postUrl}","${error}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaignId}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  }
}

export const skuPostingController = new SkuPostingController();
