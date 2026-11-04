import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import fs from 'fs';
import path from 'path';
import { imageWatermarkService, WatermarkOptions } from '../services/imageWatermark.service.js';
import { mediaStorageService } from '../services/mediaStorage.service.js';
import { MediaAsset, WatermarkTemplate } from '../models/index.js';
import { socketManager } from '../sockets/socketManager.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class WatermarkController {
  /**
   * POST /watermark/preview-single
   * Processes single image and returns base64 or temporary preview
   */
  async previewSingle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let buffer: Buffer | null = null;
      let filename = 'preview.jpg';

      if (req.file) {
        buffer = req.file.buffer;
        filename = req.file.originalname;
      } else if (req.body.assetId) {
        const asset = await MediaAsset.findById(req.body.assetId);
        if (asset) {
          const filePath = path.join(env.UPLOAD_DIR, asset.storageKey);
          if (fs.existsSync(filePath)) {
            buffer = await fs.promises.readFile(filePath);
            filename = asset.originalName;
          }
        }
      }

      if (!buffer) {
        res.status(400).json({ success: false, message: 'Không tìm thấy file ảnh để xem trước' });
        return;
      }

      const options: WatermarkOptions = {
        text: req.body.text || 'XEKO XUKA',
        textColor: req.body.textColor,
        fontSizePercent: parseFloat(req.body.fontSizePercent) || 5,
        fontStyle: req.body.fontStyle,
        hasBackground: req.body.hasBackground !== 'false' && req.body.hasBackground !== false,
        bgColor: req.body.bgColor,
        bgOpacity: parseFloat(req.body.bgOpacity) || 60,
        padding: parseFloat(req.body.padding) || 12,
        borderRadius: parseFloat(req.body.borderRadius) || 8,
        opacity: parseFloat(req.body.opacity) || 90,
        rotation: parseFloat(req.body.rotation) || 0,
        layoutMode: req.body.layoutMode || 'single',
        position: req.body.position || 'bottom-right',
        customX: parseFloat(req.body.customX) || 80,
        customY: parseFloat(req.body.customY) || 85,
        offsetX: parseFloat(req.body.offsetX) || 4,
        offsetY: parseFloat(req.body.offsetY) || 4,
        rotateImageAngle: parseFloat(req.body.rotateImageAngle) || 0,
        outputFormat: req.body.outputFormat || 'jpeg',
        outputQuality: parseInt(req.body.outputQuality) || 85,
      };

      const processedBuffer = await imageWatermarkService.applyWatermark(buffer, options);
      const mime = options.outputFormat === 'png' ? 'image/png' : options.outputFormat === 'webp' ? 'image/webp' : 'image/jpeg';
      const base64 = `data:${mime};base64,${processedBuffer.toString('base64')}`;

      res.json({
        success: true,
        data: {
          previewUrl: base64,
          filename,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /watermark/batch-process
   * Batch processes multiple images with Sharp, creates MediaAssets, and supports per-image dynamic code
   */
  async batchProcess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const files = req.files as Express.Multer.File[];
      const {
        assetIds,
        options: optionsRaw,
        codeMap: codeMapRaw,
        useDynamicCode,
        codeSource,
        rotateImageAngle,
      } = req.body;

      const baseOptions: WatermarkOptions = typeof optionsRaw === 'string' ? JSON.parse(optionsRaw) : (optionsRaw || {});
      const codeMap: Record<string, string> = typeof codeMapRaw === 'string' ? JSON.parse(codeMapRaw) : (codeMapRaw || {});

      const itemsToProcess: Array<{ filename: string; buffer: Buffer }> = [];

      // Add uploaded files
      if (files && files.length > 0) {
        for (const f of files) {
          itemsToProcess.push({ filename: f.originalname, buffer: f.buffer });
        }
      }

      // Add existing asset IDs
      if (assetIds) {
        const idList = Array.isArray(assetIds) ? assetIds : [assetIds];
        const assets = await MediaAsset.find({ _id: { $in: idList }, userId });
        for (const a of assets) {
          const p = path.join(env.UPLOAD_DIR, a.storageKey);
          if (fs.existsSync(p)) {
            const buf = await fs.promises.readFile(p);
            itemsToProcess.push({ filename: a.originalName, buffer: buf });
          }
        }
      }

      if (itemsToProcess.length === 0) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 ảnh để đóng dấu' });
        return;
      }

      const total = itemsToProcess.length;
      logger.info(`Starting batch watermark process for user ${userId}: ${total} images`);

      const processedAssets: any[] = [];

      for (let i = 0; i < total; i++) {
        const item = itemsToProcess[i];
        let itemText = baseOptions.text || 'XEKO XUKA';

        // Check if dynamic code is enabled
        if (useDynamicCode === true || useDynamicCode === 'true') {
          if (codeMap[item.filename]) {
            itemText = codeMap[item.filename];
          } else if (codeSource === 'filename') {
            // Auto extract product code from filename: e.g. "SP001_ao_thun.jpg" -> "SP001"
            const nameWithoutExt = path.parse(item.filename).name;
            const match = nameWithoutExt.match(/^([A-Za-z0-9_-]+)/);
            if (match) {
              itemText = match[1];
            } else {
              itemText = nameWithoutExt;
            }
          }
        }

        const itemOptions: WatermarkOptions = {
          ...baseOptions,
          text: itemText,
          rotateImageAngle: rotateImageAngle ? parseInt(rotateImageAngle) : baseOptions.rotateImageAngle,
        };

        const stampedBuffer = await imageWatermarkService.applyWatermark(item.buffer, itemOptions);

        // Save stamped file to storage
        const ext = itemOptions.outputFormat === 'png' ? '.png' : itemOptions.outputFormat === 'webp' ? '.webp' : '.jpg';
        const parsedName = path.parse(item.filename).name;
        const newFilename = `${parsedName}_watermarked${ext}`;
        const storageKey = mediaStorageService.generateStorageKey(userId, newFilename);
        const publicUrl = await mediaStorageService.saveLocalFile(storageKey, stampedBuffer);
        const checksum = mediaStorageService.calculateChecksum(stampedBuffer);
        const mimeType = itemOptions.outputFormat === 'png' ? 'image/png' : itemOptions.outputFormat === 'webp' ? 'image/webp' : 'image/jpeg';

        // Create MediaAsset record
        const asset = new MediaAsset({
          userId: new Types.ObjectId(userId),
          originalName: newFilename,
          mimeType,
          fileSize: stampedBuffer.length,
          storageKey,
          storageUrl: publicUrl,
          checksum,
          status: 'ready',
        });
        await asset.save();
        processedAssets.push(asset);

        // Emit realtime progress to user
        socketManager.emitToUser(userId, 'watermark:progress', {
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          filename: newFilename,
        });
      }

      logger.info(`Completed batch watermark: ${processedAssets.length}/${total} images processed`);

      res.json({
        success: true,
        message: `Đóng dấu hoàn tất ${processedAssets.length} ảnh!`,
        data: {
          total: processedAssets.length,
          assets: processedAssets,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /watermark/templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const templates = await WatermarkTemplate.find({ userId }).sort({ updatedAt: -1 });
      res.json({ success: true, data: { templates } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /watermark/templates
   */
  async saveTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      const { name, ...data } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập tên mẫu thiết kế' });
        return;
      }

      const template = await WatermarkTemplate.findOneAndUpdate(
        { userId, name: name.trim() },
        { userId, name: name.trim(), ...data },
        { upsert: true, new: true }
      );

      res.status(201).json({
        success: true,
        message: 'Lưu mẫu thiết kế thành công!',
        data: { template },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /watermark/templates/:id
   */
  async deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!._id;
      await WatermarkTemplate.findOneAndDelete({ _id: req.params.id, userId });
      res.json({ success: true, message: 'Đã xóa mẫu thiết kế' });
    } catch (error) {
      next(error);
    }
  }
}

export const watermarkController = new WatermarkController();

