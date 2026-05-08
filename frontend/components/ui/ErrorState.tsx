'use client';

import { Button } from './Button';
import { ServerCrash } from 'lucide-react';

interface ErrorStateProps {
  error: Error | string | null | undefined;
  onRetry: () => void;
  className?: string;
}

export function ErrorState({ error, onRetry, className = '' }: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error || 'An error occurred';

  return (
    <div className={`flex flex-col m-auto items-center justify-center p-6 bg-danger10 border border-ddanger0 rounded-lg text-center ${className}`}>
      <ServerCrash className="w-8 h-8 text-dangermb-2" />
      <p className="text-dangerfont-bold">{errorMessage}</p>
      <Button onClick={onRetry} className="mt-4" variant="primary">
        Try Again
      </Button>
    </div>
  );
}
