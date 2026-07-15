'use client';

import { useEffect, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api';

interface UseSocketOptions {
    /** JWT token for authentication */
    token: string | null;
    /** User info for auto-joining rooms */
    userId?: string;
    userRole?: string;
    orgId?: string;
    /** Whether to connect */
    enabled?: boolean;
}

type EventCallback = (...args: unknown[]) => void;

/**
 * Custom hook for WebSocket connectivity via Socket.IO.
 * Auto-connects with JWT auth, auto-joins user/role/org rooms, and exposes
 * subscribe/unsubscribe + joinRoom/leaveRoom helpers.
 */
// Use a singleton socket so multiple components don't open duplicate connections
let socketSingleton: Socket | null = null;
const listenersSingleton: Map<string, Set<EventCallback>> = new Map();
const connectionStateListeners = new Set<(isConnected: boolean) => void>();
const joinedRoomCounts = new Map<string, number>();
let connected = false;

function updateConnectionState(isConnected: boolean) {
    connected = isConnected;
    connectionStateListeners.forEach(listener => listener(isConnected));
}

function rejoinRequestedRooms(socket: Socket) {
    joinedRoomCounts.forEach((count, roomId) => {
        if (count > 0) socket.emit('joinRoom', { roomId });
    });
}

function attachStoredListeners(socket: Socket) {
    listenersSingleton.forEach((callbacks, event) => {
        callbacks.forEach(cb => socket.on(event, cb));
    });
}

export function useSocket(options: UseSocketOptions) {
    const { token, userId, userRole, orgId, enabled = true } = options;
    const [isConnected, setIsConnected] = useState(connected);

    useEffect(() => {
        connectionStateListeners.add(setIsConnected);
        setIsConnected(connected);
        return () => {
            connectionStateListeners.delete(setIsConnected);
        };
    }, []);

    useEffect(() => {
        if (!enabled || !token) return;

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE_URL.replace(/\/api$/, '').replace(/\/$/, '');
        if (!socketUrl.startsWith('http')) {
            console.warn('[WS] Invalid socket URL:', socketUrl);
            return;
        }

        if (socketSingleton) {
            // If socket exists but token changed, reconnect with the new auth.
            const currentAuth = socketSingleton.auth;
            const isAuthObject = typeof currentAuth === 'object' && currentAuth !== null;
            const needsUpdate = isAuthObject && (currentAuth as { token?: string }).token !== token;

            if (needsUpdate) {
                socketSingleton.disconnect();
                socketSingleton = null;
                updateConnectionState(false);
            }
        }

        if (!socketSingleton) {
            socketSingleton = io(socketUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 2000,
            });

            socketSingleton.on('connect', () => {
                socketSingleton?.emit('app:visibility', {
                    isForeground: typeof document === 'undefined' ? true : document.visibilityState === 'visible',
                });
            });
            socketSingleton.on('connected', () => {
                if (socketSingleton) rejoinRequestedRooms(socketSingleton);
                updateConnectionState(true);
                socketSingleton?.emit('app:visibility', {
                    isForeground: typeof document === 'undefined' ? true : document.visibilityState === 'visible',
                });
            });
            socketSingleton.on('disconnect', () => {
                updateConnectionState(false);
            });
            socketSingleton.on('connect_error', () => {
                updateConnectionState(false);
            });
            attachStoredListeners(socketSingleton);
        }

        // Identity rooms are joined by the authenticated gateway connection.

        const handleVisibilityChange = () => {
            socketSingleton?.emit('app:visibility', {
                isForeground: document.visibilityState === 'visible',
            });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            // Do not disconnect singleton here; keep it alive for other consumers.
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token, userId, userRole, orgId, enabled]);

    const subscribe = useCallback((event: string, callback: EventCallback) => {
        if (!listenersSingleton.has(event)) listenersSingleton.set(event, new Set());
        listenersSingleton.get(event)!.add(callback);
        socketSingleton?.on(event, callback);

        return () => {
            listenersSingleton.get(event)?.delete(callback);
            socketSingleton?.off(event, callback);
        };
    }, []);

    const joinRoom = useCallback((room: string) => {
        const currentCount = joinedRoomCounts.get(room) || 0;
        joinedRoomCounts.set(room, currentCount + 1);
        if (currentCount === 0 && socketSingleton?.connected) {
            socketSingleton.emit('joinRoom', { roomId: room });
        }
    }, []);

    const leaveRoom = useCallback((room: string) => {
        const currentCount = joinedRoomCounts.get(room) || 0;
        if (currentCount <= 1) {
            joinedRoomCounts.delete(room);
            if (socketSingleton?.connected) {
                socketSingleton.emit('leaveRoom', { roomId: room });
            }
            return;
        }
        joinedRoomCounts.set(room, currentCount - 1);
    }, []);

    const emit = useCallback((event: string, payload: unknown) => {
        socketSingleton?.emit(event, payload);
    }, []);

    return { socket: socketSingleton, subscribe, joinRoom, leaveRoom, emit, isConnected };
}

/**
 * Disconnect the socket singleton. Call this on logout to prevent
 * socket events from firing with stale tokens.
 */
export function disconnectSocket() {
    if (socketSingleton) {
        socketSingleton.disconnect();
        socketSingleton = null;
        updateConnectionState(false);
        listenersSingleton.clear();
        joinedRoomCounts.clear();
    }
}
