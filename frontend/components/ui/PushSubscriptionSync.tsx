'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { syncWebPushSubscription } from '@/lib/webPush';

export function PushSubscriptionSync() {
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token || !user?.id) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    let cancelled = false;

    const sync = async () => {
      try {
        await syncWebPushSubscription(token);
      } catch (error) {
        if (!cancelled) {
          console.warn('Push subscription sync failed:', error);
        }
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  return null;
}
