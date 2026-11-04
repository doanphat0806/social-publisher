import mongoose, { Document, Schema, Types } from 'mongoose';

export type SkuCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ISkuScheduleConfig {
  mode: 'immediate' | 'scheduled';
  startAt?: Date;
  intervalMinutes: number;
  pageSchedules?: {
    pageId: string;
    startAt: Date;
  }[];
}

export interface ISkuCampaignStats {
  totalProducts: number;
  totalImages: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  processingTasks: number;
}

export interface ISkuPostingCampaign extends Document {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  captionTemplate: string;
  priceUnit: 'K' | 'nghìn đồng' | 'VNĐ';
  showCodeLine: boolean;
  imagesPerPost: number;
  selectedPages: string[]; // Facebook page IDs
  scheduleConfig: ISkuScheduleConfig;
  status: SkuCampaignStatus;
  stats: ISkuCampaignStats;
  createdAt: Date;
  updatedAt: Date;
}

const skuPostingCampaignSchema = new Schema<ISkuPostingCampaign>(
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
    captionTemplate: {
      type: String,
      required: true,
      default: `MS {product_code}\n\n👉 Sale cực sốc chỉ còn {price}K\n👉 Số lượng chỉ còn vài chiếc thôi ạ...\n\nNhanh tay inbox ngay cho shop ạ 👌👌👌`,
    },
    priceUnit: {
      type: String,
      enum: ['K', 'nghìn đồng', 'VNĐ'],
      default: 'K',
    },
    showCodeLine: {
      type: Boolean,
      default: true,
    },
    imagesPerPost: {
      type: Number,
      default: 4,
    },
    selectedPages: {
      type: [String],
      required: true,
      default: [],
    },
    scheduleConfig: {
      mode: {
        type: String,
        enum: ['immediate', 'scheduled'],
        default: 'immediate',
      },
      startAt: {
        type: Date,
      },
      intervalMinutes: {
        type: Number,
        default: 15,
      },
      pageSchedules: [
        {
          pageId: String,
          startAt: Date,
        },
      ],
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'publishing', 'paused', 'completed', 'cancelled', 'failed'],
      default: 'draft',
      index: true,
    },
    stats: {
      totalProducts: { type: Number, default: 0 },
      totalImages: { type: Number, default: 0 },
      totalTasks: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 },
      failedTasks: { type: Number, default: 0 },
      pendingTasks: { type: Number, default: 0 },
      processingTasks: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

skuPostingCampaignSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const SkuPostingCampaign = mongoose.model<ISkuPostingCampaign>(
  'SkuPostingCampaign',
  skuPostingCampaignSchema
);

