'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { RefreshCw, ServerCrash } from 'lucide-react';
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

export function ErrorState({ error, onRetry, className = '', title, description, showRetry = true }: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error || 'An error occurred';
  const [countdown, setCountdown] = useState(0);

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
  const canRetry = showRetry && onRetry && !errorMessage.toLowerCase().includes('permission');

  return (
    <div
      className={cn(
        "m-auto flex w-full max-w-xl flex-col items-center justify-center rounded-lg border border-danger/20 bg-danger/10 p-5 text-center shadow-xs sm:p-6",
        className,
      )}
      role="alert"
    >
      <div className="mb-3 rounded-full bg-danger/10 p-2 text-danger">
        <ServerCrash className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        {title || 'Something went wrong'}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 min-h-6 text-sm font-medium text-danger">
        {countdown > 0 ? <Loading size="xs" /> : <p>{errorMessage}</p>}
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
