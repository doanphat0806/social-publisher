import mongoose, { Document, Schema, Types } from 'mongoose';
import { TaskStatus } from './PublishTask.js';

export interface ISkuPublishTask extends Document {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  productCode: string;
  pageId: string;
  facebookPageRef?: Types.ObjectId;
  caption: string;
  mediaAssetIds: Types.ObjectId[];
  scheduledAt: Date;
  status: TaskStatus;
  facebookPhotoIds: string[];
  facebookPostId?: string;
  facebookPostUrl?: string;
  attemptCount: number;
  maxAttempts: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: Date;
  publishedAt?: Date;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const skuPublishTaskSchema = new Schema<ISkuPublishTask>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'SkuPostingCampaign',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'SkuProduct',
      required: true,
      index: true,
    },
    productCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    pageId: {
      type: String,
      required: true,
      index: true,
    },
    facebookPageRef: {
      type: Schema.Types.ObjectId,
      ref: 'FacebookPage',
    },
    caption: {
      type: String,
      required: true,
    },
    mediaAssetIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MediaAsset',
      },
    ],
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'processing', 'success', 'failed', 'unknown', 'cancelled', 'paused', 'skipped'],
      default: 'pending',
      index: true,
    },
    facebookPhotoIds: {
      type: [String],
      default: [],
    },
    facebookPostId: {
      type: String,
      index: true,
    },
    facebookPostUrl: {
      type: String,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    errorCode: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    startedAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
skuPublishTaskSchema.index({ campaignId: 1, productId: 1, pageId: 1 }, { unique: true });
skuPublishTaskSchema.index({ status: 1, scheduledAt: 1 });
skuPublishTaskSchema.index({ pageId: 1, scheduledAt: 1 });
skuPublishTaskSchema.index({ campaignId: 1, status: 1 });

export const SkuPublishTask = mongoose.model<ISkuPublishTask>(
  'SkuPublishTask',
  skuPublishTaskSchema
);

