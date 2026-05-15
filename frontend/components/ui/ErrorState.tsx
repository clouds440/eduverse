'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { ServerCrash } from 'lucide-react';
import { Loading } from './Loading';

interface ErrorStateProps {
  error: Error | string | null | undefined;
  onRetry: () => void;
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
    onRetry();
  };

  return (
    <div className={`flex flex-col m-auto items-center justify-center p-6 bg-danger/10 border border-danger/20 rounded-lg text-center ${className}`}>
      <ServerCrash className="w-8 h-8 text-danger mb-2" />
      {title && <h2 className="text-danger font-bold">{title}</h2>}
      {description && <p className="text-danger font-bold">{description}</p>}
      {countdown > 0 ? <Loading size="sm" /> : <p className="text-danger font-bold">{errorMessage}</p>}
      {showRetry && !errorMessage.toLowerCase().includes('permission') &&
        <Button
          onClick={handleRetry}
          disabled={countdown > 0}
          className="mt-4"
          variant="danger"
        >
          Try Again {countdown > 0 ? `(${countdown}s)` : ''}
        </Button>
      }
    </div>
  );
}
