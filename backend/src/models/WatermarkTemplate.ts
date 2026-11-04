import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWatermarkTemplate extends Document {
  userId: Types.ObjectId;
  name: string;
  text: string;
  useDynamicCode: boolean;
  codeSource: 'filename' | 'csv' | 'custom';
  textColor: string;
  fontSizePercent: number;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  hasBackground: boolean;
  bgColor: string;
  bgOpacity: number;
  padding: number;
  borderRadius: number;
  opacity: number;
  rotation: number;
  layoutMode: 'single' | 'repeat';
  position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'custom';
  customX: number; // 0 - 100 percentage
  customY: number; // 0 - 100 percentage
  offsetX: number;
  offsetY: number;
  repeatGap: number;
  outputFormat: 'jpeg' | 'png' | 'webp';
  outputQuality: number;
  createdAt: Date;
  updatedAt: Date;
}

const watermarkTemplateSchema = new Schema<IWatermarkTemplate>(
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
    text: {
      type: String,
      default: 'XEKO XUKA',
    },
    useDynamicCode: {
      type: Boolean,
      default: false,
    },
    codeSource: {
      type: String,
      enum: ['filename', 'csv', 'custom'],
      default: 'filename',
    },
    textColor: {
      type: String,
      default: '#ffffff',
    },
    fontSizePercent: {
      type: Number,
      default: 5, // 5% of min(width, height)
    },
    fontStyle: {
      type: String,
      enum: ['normal', 'bold', 'italic', 'bold italic'],
      default: 'bold',
    },
    hasBackground: {
      type: Boolean,
      default: true,
    },
    bgColor: {
      type: String,
      default: '#000000',
    },
    bgOpacity: {
      type: Number,
      default: 60,
    },
    padding: {
      type: Number,
      default: 12,
    },
    borderRadius: {
      type: Number,
      default: 8,
    },
    opacity: {
      type: Number,
      default: 90,
    },
    rotation: {
      type: Number,
      default: 0,
    },
    layoutMode: {
      type: String,
      enum: ['single', 'repeat'],
      default: 'single',
    },
    position: {
      type: String,
      enum: [
        'top-left',
        'top-center',
        'top-right',
        'middle-left',
        'center',
        'middle-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
        'custom',
      ],
      default: 'bottom-right',
    },
    customX: {
      type: Number,
      default: 80,
    },
    customY: {
      type: Number,
      default: 85,
    },
    offsetX: {
      type: Number,
      default: 4,
    },
    offsetY: {
      type: Number,
      default: 4,
    },
    repeatGap: {
      type: Number,
      default: 150,
    },
    outputFormat: {
      type: String,
      enum: ['jpeg', 'png', 'webp'],
      default: 'jpeg',
    },
    outputQuality: {
      type: Number,
      default: 90,
    },
  },
  {
    timestamps: true,
  }
);

export const WatermarkTemplate = mongoose.model<IWatermarkTemplate>(
  'WatermarkTemplate',
  watermarkTemplateSchema
);

