import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPublishLog extends Document {
  taskId: Types.ObjectId;
  action: string;
  requestId?: string;
  responseCode?: number;
  responseData?: any;
  errorMessage?: string;
  createdAt: Date;
}

const publishLogSchema = new Schema<IPublishLog>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'PublishTask',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
    },
    requestId: {
      type: String,
    },
    responseCode: {
      type: Number,
    },
    responseData: {
      type: Schema.Types.Mixed,
    },
    errorMessage: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const PublishLog = mongoose.model<IPublishLog>('PublishLog', publishLogSchema);

