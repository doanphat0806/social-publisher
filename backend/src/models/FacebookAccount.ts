import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFacebookAccount extends Document {
  userId: Types.ObjectId;
  facebookUserId: string;
  facebookName: string;
  accessTokenEncrypted: string;
  tokenExpiresAt?: Date;
  status: 'active' | 'expired' | 'revoked';
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const facebookAccountSchema = new Schema<IFacebookAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    facebookUserId: {
      type: String,
      required: true,
      index: true,
    },
    facebookName: {
      type: String,
      required: true,
    },
    accessTokenEncrypted: {
      type: String,
      required: true,
    },
    tokenExpiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
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

facebookAccountSchema.index({ userId: 1, facebookUserId: 1 }, { unique: true });

export const FacebookAccount = mongoose.model<IFacebookAccount>('FacebookAccount', facebookAccountSchema);

