'use client';

import { io, type Socket } from 'socket.io-client';

type EventHandler<T = any> = (payload: T) => void;

let socket: Socket | null = null;

function socketUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
}

export function getSocket() {
  return socket;
}

export function connectSocket(token?: string | null) {
  if (socket?.connected) return socket;

  socket = io(socketUrl(), {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: token ? { token } : undefined,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function onSocketEvent<T = any>(event: string, handler: EventHandler<T>) {
  if (!socket) return () => undefined;
  socket.on(event, handler);
  return () => socket?.off(event, handler);
}
