import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, IUser } from '../models/User.js';

interface JwtPayload {
  userId: string;
  role: string;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // Check Authorization header: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.cookie) {
      // Cookie parsing fallback if HttpOnly cookie is used
      const match = req.headers.cookie.match(/token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tiếp tục' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(decoded.userId);

    if (!user || user.status !== 'active') {
      res.status(401).json({ success: false, message: 'Tài khoản không hợp lệ hoặc đã bị khóa' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token xác thực không hợp lệ hoặc đã hết hạn' });
  }
}

export function authorizeRole(roles: Array<'admin' | 'staff'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện hành động này' });
      return;
    }
    next();
  };
}

