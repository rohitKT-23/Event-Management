import type {
  NotificationEntityType as EntityType,
  NotificationType,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { emitToUser } from './socket.js';

export type CreateNotificationInput = {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  entityType: EntityType;
  entityId: string;
  message: string;
  payload?: Record<string, unknown>;
};

/**
 * Persist a notification then push to the recipient via WebSocket.
 * Drops self-notifications (a user shouldn't get pinged for their own actions).
 */
export async function createNotification(input: CreateNotificationInput) {
  if (input.actorId && input.actorId === input.recipientId) return null;

  const n = await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
      payload: input.payload as any,
    },
    include: { actor: { select: { id: true, username: true, avatarUrl: true } } },
  });

  emitToUser(input.recipientId, 'notification:new', n);
  return n;
}
