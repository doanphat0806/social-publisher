import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from cwd or parent directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const vercelBaseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default(vercelBaseUrl || 'http://localhost:5173'),

  // Database & Cache
  MONGO_URI: z
    .string()
    .default(
      process.env.MONGODB_URI ||
        process.env.MONGO_URI ||
        'mongodb://localhost:27017/xeko_publisher'
    ),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Security
  JWT_SECRET: z.string().default('xeko-super-secret-jwt-key-min-32-chars-long!'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // 32-byte hex or string key for AES-256-GCM
  ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  // Facebook Graph API
  FACEBOOK_APP_ID: z.string().default(''),
  FACEBOOK_APP_SECRET: z.string().default(''),
  FACEBOOK_REDIRECT_URI: z.string().default(
    vercelBaseUrl
      ? `${vercelBaseUrl}/api/v1/facebook/oauth/callback`
      : 'http://localhost:5000/api/v1/facebook/oauth/callback'
  ),
  FACEBOOK_GRAPH_VERSION: z.string().default('v22.0'),

  // Storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default(
    process.env.VERCEL ? path.resolve('/tmp', 'uploads') : path.resolve(process.cwd(), 'uploads')
  ),
  MAX_FILE_SIZE_MB: z.coerce.number().default(20), // 20MB per photo

  // S3 Compatible (optional)
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment variables validation failed');
}

export const env = parsed.data;

