import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class MediaStorageService {
  private s3Client: S3Client | null = null;
  private uploadDir: string;

  constructor() {
    this.uploadDir = env.UPLOAD_DIR;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    if (env.STORAGE_TYPE === 's3' && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      });
      logger.info('Initialized S3 storage client');
    } else {
      logger.info(`Using Local storage directory at ${this.uploadDir}`);
    }
  }

  /**
   * Generates a unique storage key for an asset
   */
  generateStorageKey(userId: string, originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(16).toString('hex');
    const dateStr = new Date().toISOString().slice(0, 10);
    return `${userId}/${dateStr}/${hash}${ext}`;
  }

  /**
   * Calculate SHA-256 checksum from buffer
   */
  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generates Presigned URL for direct upload (if S3) or returns local upload destination
   */
  async getPresignedUploadUrl(
    storageKey: string,
    mimeType: string
  ): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string }> {
    if (this.s3Client && env.S3_BUCKET) {
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: storageKey,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      const publicUrl = env.S3_ENDPOINT
        ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${storageKey}`
        : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${storageKey}`;

      return { uploadUrl, storageKey, publicUrl };
    }

    // Local upload fallback
    const uploadUrl = `/api/v1/media/upload-direct?key=${encodeURIComponent(storageKey)}`;
    const publicUrl = `/uploads/${storageKey}`;
    return { uploadUrl, storageKey, publicUrl };
  }

  /**
   * Saves buffer directly to local storage (for fallback / direct multipart upload)
   */
  async saveLocalFile(storageKey: string, buffer: Buffer): Promise<string> {
    const fullPath = path.join(this.uploadDir, storageKey);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(fullPath, buffer);
    return `/uploads/${storageKey}`;
  }

  /**
   * Get file URL suitable for Facebook Graph API
   */
  getFileUrl(storageKey: string, baseUrl: string): string {
    if (this.s3Client && env.S3_BUCKET) {
      return env.S3_ENDPOINT
        ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${storageKey}`
        : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${storageKey}`;
    }
    // For local, build full URL with host/domain
    return `${baseUrl}/uploads/${storageKey}`;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      if (this.s3Client && env.S3_BUCKET) {
        // Delete from S3
      } else {
        const fullPath = path.join(this.uploadDir, storageKey);
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
        }
      }
    } catch (err) {
      logger.error('Failed to delete file from storage:', err);
    }
  }
}

export const mediaStorageService = new MediaStorageService();

