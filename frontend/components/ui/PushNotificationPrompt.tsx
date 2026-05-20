'use client';

import { useEffect, useState, useCallback } from 'react';
import { BellRing, BellOff, AlertTriangle, Loader2, CheckCircle2, PowerOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { supportsWebPush, syncWebPushSubscription, unsubscribeCurrentWebPushSubscription } from '@/lib/webPush';

type PushState = 'unsupported' | 'denied' | 'prompt' | 'granted' | 'subscribing' | 'error';

/**
 * Inline push notification banner designed to sit inside NotificationDropdown.
 * NOT a floating modal — renders as a compact, inline element.
 */
export function PushNotificationBanner() {
  const { token } = useAuth();
  const [pushState, setPushState] = useState<PushState>('unsupported');
  const [errorMessage, setErrorMessage] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);

  const updatePushState = useCallback((nextState: PushState) => {
    window.setTimeout(() => setPushState(nextState), 0);
  }, []);

  const syncSubscription = useCallback(async (authToken: string) => {
    try {
      await syncWebPushSubscription(authToken);
      updatePushState('granted');
      setErrorMessage('');
    } catch (error) {
      console.warn('Silent push sync failed:', error);
      updatePushState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Push subscription could not be synced.');
    }
  }, [updatePushState]);

  useEffect(() => {
    if (!supportsWebPush()) {
      updatePushState('unsupported');
      return;
    }

    const permission = Notification.permission;
    if (permission === 'denied') {
      updatePushState('denied');
    } else if (permission === 'granted') {
      // Silently ensure subscription is synced
      if (token) window.setTimeout(() => void syncSubscription(token), 0);
    } else {
      updatePushState('prompt');
    }
  }, [syncSubscription, token, updatePushState]);

  const handleEnable = useCallback(async () => {
    if (!token) return;
    setPushState('subscribing');
    setErrorMessage('');

    let completed = false;

    // Safety timeout — only fires if the whole flow hasn't completed
    const timeoutId = setTimeout(() => {
      if (!completed) {
        completed = true;
        setPushState('error');
        setErrorMessage('Push setup timed out before the subscription could be saved.');
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
      await syncWebPushSubscription(token);
      if (completed) return;

      completed = true;
      clearTimeout(timeoutId);
      setPushState('granted');
    } catch (err: unknown) {
      if (completed) return;
      completed = true;
      clearTimeout(timeoutId);
      console.error('Failed to enable push notifications:', err);

      // If the browser permission is actually granted, show success anyway
      setPushState('error');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  }, [token]);

  const handleTestPush = useCallback(async () => {
    if (!token || isTesting) return;
    setIsTesting(true);
    setErrorMessage('');

    try {
      const payload = await syncWebPushSubscription(token);
      await api.notifications.testPush(token, payload.endpoint);
    } catch (err: unknown) {
      setPushState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Test notification failed.');
    } finally {
      setIsTesting(false);
    }
  }, [isTesting, token]);

  const handleUnsubscribe = useCallback(async () => {
    if (!token || isUnsubscribing) return;
    setIsUnsubscribing(true);
    setErrorMessage('');

    try {
      await unsubscribeCurrentWebPushSubscription(token);

      setPushState(Notification.permission === 'denied' ? 'denied' : 'prompt');
    } catch (err: unknown) {
      setPushState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to turn off push notifications.');
    } finally {
      setIsUnsubscribing(false);
    }
  }, [isUnsubscribing, token]);

  if (pushState === 'unsupported') return null;

  return (
    <div className="px-4 py-3 border-b border-border bg-primary/5">
      {pushState === 'granted' ? (
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-success shrink-0" />
          <p className="text-[11px] text-muted-foreground font-medium flex-1">
            Push notifications enabled
          </p>
          <button
            onClick={handleTestPush}
            disabled={isTesting}
            className="text-[10px] font-bold text-primary hover:underline shrink-0 disabled:opacity-60 cursor-pointer"
          >
            {isTesting ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={handleUnsubscribe}
            disabled={isUnsubscribing}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-danger shrink-0 disabled:opacity-60 cursor-pointer"
            title="Turn off push notifications"
          >
            <PowerOff size={12} />
            {isUnsubscribing ? 'Turning off...' : 'Off'}
          </button>
        </div>
      ) : pushState === 'denied' ? (
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
