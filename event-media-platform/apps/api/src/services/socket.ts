/**
 * Socket.io server. Mounts on the existing HTTP server (see server.ts).
 *
 * Auth: JWT access token sent via `auth.token` field on handshake OR
 * via cookie `access_token`. Authenticated sockets join `user:<id>`.
 */
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../lib/tokens.js';
import { corsOrigins } from '../config/env.js';
import { logger } from '../lib/logger.js';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        (socket.handshake.headers.cookie
          ?.split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('access_token='))
          ?.split('=')[1]);
      if (!token) return next(new Error('Missing auth token'));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch (err) {
      next(err instanceof Error ? err : new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data as { userId: string };
    socket.join(`user:${userId}`);
    logger.debug({ userId, socketId: socket.id }, 'socket connected');

    socket.on('disconnect', (reason) => {
      logger.debug({ userId, socketId: socket.id, reason }, 'socket disconnected');
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

/** Push a notification to a specific user across all their sockets. */
export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}
