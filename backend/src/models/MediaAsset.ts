import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMediaAsset extends Document {
  userId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  storageUrl: string;
  checksum: string;
  width?: number;
  height?: number;
  status: 'pending' | 'ready' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const mediaAssetSchema = new Schema<IMediaAsset>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    storageUrl: {
      type: String,
      required: true,
    },
    checksum: {
      type: String,
      required: true,
      index: true,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'ready', 'failed'],
      default: 'ready',
    },
  },
  {
    timestamps: true,
  }
);

mediaAssetSchema.index({ userId: 1, checksum: 1 });

export const MediaAsset = mongoose.model<IMediaAsset>('MediaAsset', mediaAssetSchema);

