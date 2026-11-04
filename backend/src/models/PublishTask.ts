import mongoose, { Document, Schema, Types } from 'mongoose';

export type TaskStatus = 
  | 'pending'
  | 'queued'
  | 'processing'
  | 'success'
  | 'failed'
  | 'unknown'
  | 'cancelled'
  | 'paused'
  | 'skipped';

export interface IPublishTask extends Document {
  campaignId: Types.ObjectId;
  postId: Types.ObjectId;
  pageId: string;
  facebookPageRef?: Types.ObjectId;
  scheduledAt: Date;
  status: TaskStatus;
  facebookPhotoIds: string[]; // For resumable unpublished photo uploads
  facebookPostId?: string;
  facebookPostUrl?: string;
  attemptCount: number;
  maxAttempts: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const publishTaskSchema = new Schema<IPublishTask>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
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
  },
  {
    timestamps: true,
  }
);

// CRUCIAL: Compound unique index prevents any duplicate task
publishTaskSchema.index({ campaignId: 1, postId: 1, pageId: 1 }, { unique: true });
publishTaskSchema.index({ status: 1, scheduledAt: 1 });

export const PublishTask = mongoose.model<IPublishTask>('PublishTask', publishTaskSchema);

