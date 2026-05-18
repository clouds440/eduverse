'use client';

import { useEffect, useState, useCallback } from 'react';
import { BellRing, BellOff, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

type PushState = 'unsupported' | 'denied' | 'prompt' | 'granted' | 'subscribing' | 'error';

/**
 * Inline push notification banner designed to sit inside NotificationDropdown.
 * NOT a floating modal — renders as a compact, inline element.
 */
export function PushNotificationBanner() {
  const { token } = useAuth();
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushState('unsupported');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      setPushState('denied');
    } else if (permission === 'granted') {
      setPushState('granted');
      // Silently ensure subscription is synced
      if (token) syncSubscription(token);
    } else {
      setPushState('prompt');
    }
  }, [token]);

  const syncSubscription = async (authToken: string) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) return;
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });
      }
      await api.notifications.subscribeToPush(subscription, authToken);
    } catch {
      // Silent sync failure is fine
    }
  };

  const handleEnable = useCallback(async () => {
    if (!token) return;
    setPushState('subscribing');
    setErrorMessage('');

    let completed = false;

    // Safety timeout — only fires if the whole flow hasn't completed
    const timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        // Check if permission was actually granted despite timeout
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          setPushState('granted');
        } else {
          setPushState('error');
          setErrorMessage('Request timed out. Your browser may have blocked the prompt.');
        }
      }
    }, 7000);

    try {
      // First, request browser permission
      const permission = await Notification.requestPermission();

      if (completed) return; // Timeout already fired

      if (permission === 'denied') {
        completed = true;
        clearTimeout(timeoutId);
        setPushState('denied');
        return;
      }

      if (permission !== 'granted') {
        completed = true;
        clearTimeout(timeoutId);
        setPushState('error');
        setErrorMessage('Permission was not granted.');
        return;
      }

      // Permission granted — subscribe to PushManager
      const registration = await navigator.serviceWorker.ready;
      if (completed) return;

      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        completed = true;
        clearTimeout(timeoutId);
        // Still granted at browser level, just can't sync to backend
        setPushState('granted');
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });
      }
      if (completed) return;

      // Try to sync with backend — but don't block on it
      try {
        await api.notifications.subscribeToPush(subscription, token);
      } catch (syncErr) {
        console.warn('Backend push sync failed, will retry later:', syncErr);
      }

      completed = true;
      clearTimeout(timeoutId);
      setPushState('granted');
    } catch (err: any) {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutId);
      console.error('Failed to enable push notifications:', err);

      // If the browser permission is actually granted, show success anyway
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        setPushState('granted');
      } else {
        setPushState('error');
        setErrorMessage(err?.message || 'An unexpected error occurred.');
      }
    }
  }, [token]);

  // Don't render anything if already granted or unsupported
  if (pushState === 'granted' || pushState === 'unsupported') return null;

  return (
    <div className="px-4 py-3 border-b border-border bg-primary/5">
      {pushState === 'denied' ? (
        <div className="flex items-center gap-2.5">
          <BellOff size={16} className="text-muted-foreground shrink-0" />
          <p className="text-[11px] text-muted-foreground font-medium leading-snug">
            Push notifications are blocked. Enable them in your browser settings.
          </p>
        </div>
      ) : pushState === 'error' ? (
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium leading-snug truncate">
              {errorMessage || 'Failed to enable notifications.'}
            </p>
          </div>
          <button
            onClick={handleEnable}
            className="text-[10px] font-bold text-primary hover:underline shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : pushState === 'subscribing' ? (
        <div className="flex items-center gap-2.5">
          <Loader2 size={16} className="text-primary animate-spin shrink-0" />
          <p className="text-[11px] text-muted-foreground font-medium">
            Enabling push notifications...
          </p>
        </div>
      ) : (
        /* pushState === 'prompt' */
        <div className="flex items-center gap-2.5">
          <BellRing size={16} className="text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground font-medium flex-1">
            Get alerts for chats & grades
          </p>
          <button
            onClick={handleEnable}
            className="text-[10px] font-black text-primary-foreground bg-primary hover:bg-primary/80 px-3 py-1.5 rounded-lg transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            Enable
          </button>
        </div>
      )}
    </div>
  );
}
