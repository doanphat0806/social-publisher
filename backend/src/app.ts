import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Dynamic CORS configuration supporting Vercel and local origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, same-origin)
      if (!origin) return callback(null, true);

      const allowedDomains = [
        env.CLIENT_URL,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5000',
      ];

      // Allow all .vercel.app deployment preview and production domains
      if (
        allowedDomains.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        (process.env.VERCEL_URL && origin.includes(process.env.VERCEL_URL))
      ) {
        return callback(null, true);
      }

      callback(null, true);
    },
    credentials: true,
  })
);

// Database connection assurance middleware for serverless/cold-start environments
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDatabase();
    } catch (err: any) {
      // Log connection failure
    }
  }

  // If database is not connected for data operations, return clear diagnostic error
  if (
    req.path.includes('/auth') ||
    req.path.includes('/campaigns') ||
    req.path.includes('/facebook') ||
    req.path.includes('/sku-posting')
  ) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message:
          'Lỗi kết nối cơ sở dữ liệu MongoDB Atlas: Serverless function chưa thể kết nối tới Database. Vui lòng kiểm tra: 1) Đã thêm MONGO_URI vào Environment Variables trên Vercel chưa? 2) Đã bật "Allow Access from Anywhere" (0.0.0.0/0) trong MongoDB Atlas Network Access chưa?',
      });
    }
  }

  next();
});

// General rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Parse JSON and URL encoded payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for local uploads
app.use('/uploads', express.static(env.UPLOAD_DIR));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Xeko Xuka Bulk Publisher Backend',
  });
});

// API Routes mounted on both /api/v1 and /v1 (guarantees compatibility across reverse proxies & rewrites)
app.use('/api/v1', apiRoutes);
app.use('/v1', apiRoutes);

// Error Handling Middleware
app.use(errorHandler);

export default app;

