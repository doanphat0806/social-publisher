import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, role } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({ success: false, message: 'Email này đã được đăng ký' });
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = new User({
        email,
        passwordHash,
        name,
        role: role || 'staff',
        status: 'active',
      });

      await user.save();

      const token = jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
        expiresIn: '7d',
      });

      res.status(201).json({
        success: true,
        message: 'Đăng ký tài khoản thành công',
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
        return;
      }

      if (user.status !== 'active') {
        res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
        return;
      }

      const token = jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
        expiresIn: '7d',
      });

      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    res.json({ success: true, message: 'Đăng xuất thành công' });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const user = req.user!;
    const token = jwt.sign({ userId: user._id, role: user.role }, env.JWT_SECRET, {
      expiresIn: '7d',
    });
    res.json({ success: true, data: { token } });
  }
}

export const authController = new AuthController();

