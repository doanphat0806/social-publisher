import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFacebookPage extends Document {
  userId: Types.ObjectId;
  facebookAccountId: Types.ObjectId;
  pageId: string;
  pageName: string;
  pageCategory?: string;
  avatarUrl?: string;
  pageAccessTokenEncrypted: string;
  permissions: string[];
  status: 'active' | 'expired' | 'revoked' | 'permission_denied';
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const facebookPageSchema = new Schema<IFacebookPage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    facebookAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'FacebookAccount',
      required: true,
      index: true,
    },
    pageId: {
      type: String,
      required: true,
      index: true,
    },
    pageName: {
      type: String,
      required: true,
    },
    pageCategory: {
      type: String,
    },
    avatarUrl: {
      type: String,
    },
    pageAccessTokenEncrypted: {
      type: String,
      required: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked', 'permission_denied'],
      default: 'active',
      index: true,
    },
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index by userId + pageId
facebookPageSchema.index({ userId: 1, pageId: 1 }, { unique: true });

export const FacebookPage = mongoose.model<IFacebookPage>('FacebookPage', facebookPageSchema);

