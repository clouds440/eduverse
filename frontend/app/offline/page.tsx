'use client';

import { WifiOff, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function OfflinePage() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-theme-bg">
      <div className="max-w-md w-full bg-card/50 backdrop-blur-xl border border-border/10 p-10 rounded-3xl flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mb-6 relative z-10">
          <WifiOff size={40} strokeWidth={1.5} />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-3 relative z-10 tracking-tight">
          You&apos;re Offline
        </h1>
        
        <p className="text-muted-foreground font-medium mb-8 relative z-10 leading-relaxed text-sm sm:text-base">
          It looks like you&apos;ve lost your internet connection. We couldn&apos;t reach the server. Please check your network and try again.
        </p>

        <Button 
          onClick={handleReload}
          variant="primary"
          className="w-full h-12 text-sm font-bold relative z-10 flex items-center justify-center gap-2"
        >
          <RefreshCcw size={16} />
          Try Again
        </Button>
      </div>
    </div>
  );
}
