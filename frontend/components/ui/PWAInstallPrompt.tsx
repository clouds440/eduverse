'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.error('PWA Service Worker registration failed:', error);
          });
      });
    }

    // 2. Check if already dismissed
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('eduverse-pwa-dismissed') === 'true';
      if (isDismissed) return;

      // 3. Detect Standalone Mode
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true;
      if (isStandalone) return;

      // 4. Handle Standard PWA Install Prompt (Chrome, Edge, Android)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShowPrompt(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // 5. Handle iOS Custom Prompt Detection
      const isIOSDevice = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
      if (isIOSDevice && !isStandalone) {
        // Show iOS instructions for installation
        setShowIOSPrompt(true);
      }

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show native browser prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // Clear prompt state
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSPrompt(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eduverse-pwa-dismissed', 'true');
    }
  };

  if (!showPrompt && !showIOSPrompt) return null;

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto md:max-w-md z-50 animate-in fade-in slide-in-from-bottom duration-500">
      {/* Chrome / Android / Desktop Install Prompt */}
      {showPrompt && (
        <div className="bg-card/90 backdrop-blur-xl border border-primary/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-primary">
            <Sparkles className="w-24 h-24" />
          </div>

          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X size={16} />
          </button>

          <div className="flex gap-3 items-start pr-6">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shrink-0 shadow-sm">
              <Download size={22} className="animate-pulse" />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-black text-[14px] sm:text-[15px] tracking-tight text-foreground leading-tight">
                Install EduVerse App
              </h4>
              <p className="text-[11px] sm:text-[12px] text-muted-foreground leading-normal font-medium">
                Install the official web app for full-screen management, lightning-fast speeds, and instant offline access!
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 mt-1 border-t border-border/40 pt-3">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 hover:bg-muted/40 rounded-xl text-xs font-bold text-muted-foreground transition-all cursor-pointer"
            >
              Maybe Later
            </button>
            <Button
              onClick={handleInstallClick}
              variant="primary"
              className="flex items-center gap-1.5 text-xs font-black px-5 py-2.5 bg-primary text-foreground rounded-xl shadow-lg shadow-primary/20 border-none hover:bg-primary/80 transition-all active:scale-95"
            >
              INSTALL NOW
            </Button>
          </div>
        </div>
      )}

      {/* iOS Safari Custom Instructions Prompt */}
      {showIOSPrompt && (
        <div className="bg-card/90 backdrop-blur-xl border border-primary/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X size={16} />
          </button>

          <div className="flex gap-3 items-start pr-6">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 text-primary shrink-0 shadow-sm">
              <Download size={22} />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-black text-[14px] sm:text-[15px] tracking-tight text-foreground leading-tight">
                Add EduVerse to Home Screen
              </h4>
              <p className="text-[11px] sm:text-[12px] text-muted-foreground leading-normal font-medium">
                Get full app-like navigation and rapid school access on your iOS device in just a few taps.
              </p>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-3.5 flex flex-col gap-2.5">
            <p className="text-[10px] font-black uppercase text-primary/80 tracking-widest leading-none">Installation Guide</p>
            <div className="flex flex-col gap-2 text-[11px] sm:text-[12px] text-muted-foreground font-medium">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center border border-primary/25 shrink-0">1</span>
                <span>Tap the <span className="inline-flex items-center gap-0.5 font-bold text-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded border border-border"><Share size={12} className="inline text-primary" /> Share</span> icon in Safari.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-black flex items-center justify-center border border-primary/25 shrink-0">2</span>
                <span>Scroll down and select <span className="inline-flex items-center gap-1 font-bold text-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded border border-border"><PlusSquare size={12} className="inline text-primary" /> Add to Home Screen</span>.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-border/40 pt-3 mt-1">
            <button
              onClick={handleDismiss}
              className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary-light text-xs font-black rounded-xl border border-primary/20 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
