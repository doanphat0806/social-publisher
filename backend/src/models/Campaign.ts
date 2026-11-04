import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICampaignStats {
  totalPosts: number;
  totalPublishes: number;
  successfulPublishes: number;
  failedPublishes: number;
  pendingPublishes: number;
  processingPublishes: number;
}

export interface ICampaign extends Document {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  caption: string;
  totalImages: number;
  imagesPerPost: number;
  totalPosts: number;
  pageIds: string[]; // Facebook page IDs
  intervalMinutes: number;
  startAt: Date;
  timezone: string;
  distributionMode: 'all_pages' | 'round_robin';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  stats: ICampaignStats;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    caption: {
      type: String,
      default: '',
    },
    totalImages: {
      type: Number,
      required: true,
      default: 0,
    },
    imagesPerPost: {
      type: Number,
      required: true,
      default: 10,
    },
    totalPosts: {
      type: Number,
      required: true,
      default: 0,
    },
    pageIds: {
      type: [String],
      required: true,
      default: [],
    },
    intervalMinutes: {
      type: Number,
      required: true,
      default: 15,
    },
    startAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    timezone: {
      type: String,
      default: 'Asia/Ho_Chi_Minh',
    },
    distributionMode: {
      type: String,
      enum: ['all_pages', 'round_robin'],
      default: 'all_pages',
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    stats: {
      totalPosts: { type: Number, default: 0 },
      totalPublishes: { type: Number, default: 0 },
      successfulPublishes: { type: Number, default: 0 },
      failedPublishes: { type: Number, default: 0 },
      pendingPublishes: { type: Number, default: 0 },
      processingPublishes: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

campaignSchema.index({ userId: 1, createdAt: -1 });

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema);

