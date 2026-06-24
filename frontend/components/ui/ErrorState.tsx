'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import {
  AlertTriangle,
  ClockAlert,
  LockKeyhole,
  RefreshCw,
  SearchX,
  ServerCrash,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Loading } from './Loading';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  error: Error | string | null | undefined;
  onRetry?: () => void;
  showRetry?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

interface FriendlyError {
  icon: LucideIcon;
  title: string;
  message: string;
}

type Reachability = 'checking' | 'online' | 'offline' | null;
type ReachabilityResult = { key: string; value: 'online' | 'offline' };

function getErrorMessage(error: Error | string | null | undefined): string {
  if (error instanceof Error) return error.message;
  return error || 'An error occurred';
}

function getErrorStatus(error: Error | string | null | undefined): number | undefined {
  const rawMessage = getErrorMessage(error);
  const statusFromMessage = rawMessage.match(/status\s+(\d{3})/i)?.[1];

  if (statusFromMessage) return Number(statusFromMessage);
  if (!error || typeof error === 'string') return undefined;

  const withStatus = error as Error & {
    status?: unknown;
    response?: {
      status?: unknown;
    };
  };

  if (typeof withStatus.status === 'number') return withStatus.status;
  if (typeof withStatus.response?.status === 'number') return withStatus.response.status;

  return undefined;
}

function isBrowserReportingOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isConnectionError(error: Error | string | null | undefined): boolean {
  const rawMessage = getErrorMessage(error).trim();
  const status = getErrorStatus(error);
  const message = rawMessage.toLowerCase();

  return (
    status === 0 ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('fetch failed') ||
    message.includes('load failed') ||
    message.includes('unable to reach the server') ||
    message.includes('err_connection_refused') ||
    message.includes('econnrefused')
  );
}

async function checkAppReachability(signal: AbortSignal): Promise<void> {
  if (typeof window === 'undefined') throw new Error('Browser unavailable');

  const pingUrl = new URL('/api/__connectivity-ping', window.location.origin);
  pingUrl.searchParams.set('t', String(Date.now()));

  await fetch(pingUrl, {
    method: 'HEAD',
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  });
}

function getFriendlyError(error: Error | string | null | undefined, reachability: Reachability): FriendlyError {
  const rawMessage = getErrorMessage(error).trim();
  const status = getErrorStatus(error);
  const message = rawMessage.toLowerCase();
  const connectionError = isConnectionError(error);

  if (message.includes('request timed out') || message.includes('timeout')) {
    return {
      icon: ClockAlert,
      title: 'Request timed out',
      message: 'This took longer than expected. Please try again.',
    };
  }

  if (status === 401 || status === 403 || message.includes('permission')) {
    return {
      icon: LockKeyhole,
      title: 'Access needed',
      message: 'You do not have permission to view this information.',
    };
  }

  if (
    message.includes('cannot get') ||
    message.includes("can't get") ||
    message.includes('cannot post') ||
    message.includes("can't post") ||
    message.includes('cannot put') ||
    message.includes("can't put") ||
    message.includes('cannot patch') ||
    message.includes("can't patch") ||
    message.includes('cannot delete') ||
    message.includes("can't delete")
  ) {
    return {
      icon: SearchX,
      title: 'Could not find that data',
      message: 'This screen asked for something the server could not find. Refresh and try once more.',
    };
  }

  if (
    (typeof status === 'number' && status >= 500) ||
    message.includes('internal server error') ||
    message.includes('server error') ||
    message.includes('invisible goblins')
  ) {
    return {
      icon: AlertTriangle,
      title: 'Something went wrong',
      message: 'The server hit a snag while loading this. Please try again in a moment.',
    };
  }

  if (connectionError && reachability === 'checking') {
    return {
      icon: AlertTriangle,
      title: 'Checking connection',
      message: 'Checking whether this is your connection or the school server.',
    };
  }

  if (connectionError && (reachability === 'offline' || (isBrowserReportingOffline() && reachability !== 'online'))) {
    return {
      icon: WifiOff,
      title: 'No internet connection',
      message: 'You seem to be offline. Check your connection, then try again.',
    };
  }

  if (connectionError) {
    return {
      icon: ServerCrash,
      title: 'Server is not responding',
      message: 'The school server seems to be taking a quick nap. Please try again in a moment.',
    };
  }

  return {
    icon: AlertTriangle,
    title: 'Something went wrong',
    message: rawMessage || 'An unexpected error occurred. Please try again.',
  };
}

export function ErrorState({ error, onRetry, className = '', title, description, showRetry = true }: ErrorStateProps) {
  const status = getErrorStatus(error);
  const shouldCheckReachability = isBrowserReportingOffline() || isConnectionError(error);
  const reachabilityKey = `${getErrorMessage(error)}:${status ?? 'none'}:${shouldCheckReachability}`;
  const [reachabilityResult, setReachabilityResult] = useState<ReachabilityResult | null>(null);
  const reachability: Reachability = shouldCheckReachability
    ? reachabilityResult?.key === reachabilityKey ? reachabilityResult.value : 'checking'
    : null;
  const friendlyError = getFriendlyError(error, reachability);
  const ErrorIcon = friendlyError.icon;
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!shouldCheckReachability) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);

    checkAppReachability(controller.signal)
      .then(() => setReachabilityResult({ key: reachabilityKey, value: 'online' }))
      .catch(() => setReachabilityResult({ key: reachabilityKey, value: 'offline' }))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [reachabilityKey, shouldCheckReachability]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleRetry = () => {
    setCountdown(5);
    onRetry?.();
  };
  const canRetry = showRetry && onRetry && status !== 401 && status !== 403 && !getErrorMessage(error).toLowerCase().includes('permission');

  return (
    <div
      className={cn(
        "m-auto flex w-full max-w-xl flex-col items-center justify-center rounded-lg border border-danger/20 bg-danger/10 p-5 text-center shadow-xs sm:p-6",
        className,
      )}
      role="alert"
    >
      <div className="mb-3 rounded-full bg-danger/10 p-2 text-danger">
        <ErrorIcon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        {title || friendlyError.title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 min-h-6 text-sm font-medium text-danger">
        {countdown > 0 ? <Loading size="xs" /> : <p>{friendlyError.message}</p>}
      </div>
      {canRetry &&
        <Button
          onClick={handleRetry}
          disabled={countdown > 0}
          className="mt-4"
          variant="danger"
          size="sm"
          icon={RefreshCw}
        >
          Try Again {countdown > 0 ? `(${countdown}s)` : ''}
        </Button>
      }
    </div>
  );
}
