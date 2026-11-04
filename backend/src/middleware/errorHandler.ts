import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled request error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  // Handle Mongoose duplicate key
  if (err.code === 11000) {
    res.status(409).json({
      success: false,
      message: 'Dữ liệu đã tồn tại trong hệ thống (Duplicate Key)',
      details: err.keyValue,
    });
    return;
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Đã có lỗi hệ thống xảy ra',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

