'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { connectSocket, disconnectSocket, onSocketEvent } from '@/lib/socket';

type UploadCompletePayload = {
  mediaId?: string;
  status?: string;
  duplicates?: number;
};

type NotificationPayload = {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  message: string;
  createdAt: string;
  actor?: { username?: string };
  isRead?: boolean;
};

export function SocketBridge() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  React.useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    connectSocket(accessToken);

    const offNotification = onSocketEvent<NotificationPayload>('notification:new', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });

      const actor = payload.actor?.username ? `${payload.actor.username} ` : '';
      toast.info(`${actor}${payload.message}`);
    });

    const offUploadComplete = onSocketEvent<UploadCompletePayload>('upload:complete', (payload) => {
      const status = payload.status?.toUpperCase();
      if (status === 'FAILED') {
        toast.error('Upload processing failed.');
      } else {
        toast.success('Upload processed and ready.');
      }
    });

    const offUploadProgress = onSocketEvent('upload:progress', () => {
      // Keep this lightweight; upload page handles detailed progress polling.
    });

    return () => {
      offNotification();
      offUploadComplete();
      offUploadProgress();
    };
  }, [accessToken, queryClient, user]);

  return null;
}
