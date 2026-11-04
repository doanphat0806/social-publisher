import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPost extends Document {
  campaignId: Types.ObjectId;
  postNumber: number;
  caption: string;
  mediaIds: Types.ObjectId[];
  totalImages: number;
  status: 'pending' | 'scheduled' | 'publishing' | 'completed' | 'partial_failed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    postNumber: {
      type: Number,
      required: true,
    },
    caption: {
      type: String,
      default: '',
    },
    mediaIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MediaAsset',
      },
    ],
    totalImages: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'publishing', 'completed', 'partial_failed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ campaignId: 1, postNumber: 1 }, { unique: true });

export const Post = mongoose.model<IPost>('Post', postSchema);

