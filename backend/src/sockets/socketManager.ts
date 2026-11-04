import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface SocketUser {
  userId: string;
  role: string;
}

export class SocketManager {
  private io: Server | null = null;

  initialize(server: HttpServer): Server {
    this.io = new Server(server, {
      cors: {
        origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
        credentials: true,
      },
    });

    // Authenticate socket connections
    this.io.use((socket: Socket, next) => {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser;
        socket.data.user = decoded;
        next();
      } catch (err) {
        next(new Error('Invalid or expired socket token'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user as SocketUser;
      const userRoom = `user_${user.userId}`;
      socket.join(userRoom);
      logger.info(`Socket connected: ${socket.id} (User: ${user.userId}) joined ${userRoom}`);

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });

    return this.io;
  }

  getIO(): Server {
    if (!this.io) {
      throw new Error('Socket.io has not been initialized');
    }
    return this.io;
  }

  /**
   * Emits event to a specific user room
   */
  emitToUser(userId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`user_${userId}`).emit(event, data);
    }
  }

  /**
   * Broadcasts to all connected clients
   */
  broadcast(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}

export const socketManager = new SocketManager();

