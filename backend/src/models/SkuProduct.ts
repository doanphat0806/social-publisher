import mongoose, { Document, Schema, Types } from 'mongoose';

export type SkuProductStatus =
  | 'ready'
  | 'missing_images'
  | 'excess_images'
  | 'no_images'
  | 'skipped';

export interface ISkuProduct extends Document {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  productCode: string;
  price: number;
  mediaAssetIds: Types.ObjectId[];
  caption?: string; // Optional custom caption overriding template
  imageCount: number;
  status: SkuProductStatus;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const skuProductSchema = new Schema<ISkuProduct>(
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
    productCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    mediaAssetIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MediaAsset',
      },
    ],
    caption: {
      type: String,
    },
    imageCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['ready', 'missing_images', 'excess_images', 'no_images', 'skipped'],
      default: 'ready',
      index: true,
    },
    orderIndex: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

skuProductSchema.index({ campaignId: 1, productCode: 1 });
skuProductSchema.index({ campaignId: 1, status: 1 });

export const SkuProduct = mongoose.model<ISkuProduct>('SkuProduct', skuProductSchema);

