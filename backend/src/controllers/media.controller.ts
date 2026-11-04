import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { MediaAsset } from '../models/MediaAsset.js';
import { mediaStorageService } from '../services/mediaStorage.service.js';
import { env } from '../config/env.js';

export class MediaController {
  /**
   * POST /media/presign
   */
  async presign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const { fileName, mimeType, fileSize, checksum, campaignId } = req.body;

      // Check duplicate by checksum for this user
      const existing = await MediaAsset.findOne({ userId, checksum, status: 'ready' });
      if (existing) {
        res.json({
          success: true,
          isDuplicate: true,
          data: {
            asset: existing,
          },
        });
        return;
      }

      const storageKey = mediaStorageService.generateStorageKey(userId, fileName);
      const { uploadUrl, publicUrl } = await mediaStorageService.getPresignedUploadUrl(storageKey, mimeType);

      const asset = new MediaAsset({
        userId: new Types.ObjectId(userId),
        campaignId: campaignId ? new Types.ObjectId(campaignId) : undefined,
        originalName: fileName,
        mimeType,
        fileSize,
        storageKey,
        storageUrl: publicUrl,
        checksum,
        status: 'pending',
      });
      await asset.save();

      res.status(201).json({
        success: true,
        isDuplicate: false,
        data: {
          assetId: asset._id,
          uploadUrl,
          storageKey,
          publicUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /media/complete
   */
  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const { assetId, width, height } = req.body;

      const asset = await MediaAsset.findOne({ _id: assetId, userId });
      if (!asset) {
        res.status(404).json({ success: false, message: 'File không tồn tại' });
        return;
      }

      asset.status = 'ready';
      if (width) asset.width = width;
      if (height) asset.height = height;
      await asset.save();

      res.json({ success: true, data: { asset } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /media/upload-direct (local multipart upload)
   */
  async uploadDirect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Không có file nào được tải lên' });
        return;
      }

      const file = req.file;
      const checksum = mediaStorageService.calculateChecksum(file.buffer);

      // Check if duplicate exists for this user
      const existing = await MediaAsset.findOne({ userId, checksum, status: 'ready' });
      if (existing) {
        res.json({
          success: true,
          isDuplicate: true,
          data: { asset: existing },
        });
        return;
      }

      const storageKey = mediaStorageService.generateStorageKey(userId, file.originalname);
      const publicUrl = await mediaStorageService.saveLocalFile(storageKey, file.buffer);

      const asset = new MediaAsset({
        userId: new Types.ObjectId(userId),
        campaignId: req.body.campaignId ? new Types.ObjectId(req.body.campaignId) : undefined,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        storageKey,
        storageUrl: publicUrl,
        checksum,
        status: 'ready',
      });
      await asset.save();

      res.status(201).json({
        success: true,
        isDuplicate: false,
        data: { asset },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /media
   */
  async getMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 30);
      const search = req.query.search as string;

      const query: any = { userId, status: 'ready' };
      if (search) {
        query.originalName = { $regex: search, $options: 'i' };
      }

      const [total, assets] = await Promise.all([
        MediaAsset.countDocuments(query),
        MediaAsset.find(query)
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
          assets,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /media/:id
   */
  async getMediaById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const asset = await MediaAsset.findOne({ _id: req.params.id, userId });
      if (!asset) {
        res.status(404).json({ success: false, message: 'Hình ảnh không tồn tại' });
        return;
      }
      res.json({ success: true, data: { asset } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /media/:id
   */
  async deleteMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const asset = await MediaAsset.findOne({ _id: req.params.id, userId });
      if (!asset) {
        res.status(404).json({ success: false, message: 'Hình ảnh không tồn tại' });
        return;
      }

      await mediaStorageService.deleteFile(asset.storageKey);
      await asset.deleteOne();

      res.json({ success: true, message: 'Đã xóa ảnh thành công' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /media/bulk-delete
   */
  async bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ' });
        return;
      }

      const assets = await MediaAsset.find({ _id: { $in: ids }, userId });
      for (const asset of assets) {
        await mediaStorageService.deleteFile(asset.storageKey);
      }

      await MediaAsset.deleteMany({ _id: { $in: ids }, userId });
      res.json({ success: true, message: `Đã xóa ${assets.length} hình ảnh` });
    } catch (error) {
      next(error);
    }
  }
}

export const mediaController = new MediaController();

