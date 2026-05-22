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

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const isStandaloneDisplay = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as NavigatorWithStandalone).standalone === true;

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    let removeControllerChange: (() => void) | undefined;
    let viewportRaf: number | null = null;
    let settleTimers: number[] = [];
    let handleBeforeInstallPrompt: ((event: Event) => void) | undefined;
    let handleAppInstalled: (() => void) | undefined;
    const addMediaQueryListener = (query: MediaQueryList, handler: () => void) => {
      if ('addEventListener' in query) {
        query.addEventListener('change', handler);
        return () => query.removeEventListener('change', handler);
      }

      const legacyQuery = query as MediaQueryList & {
        addListener: (listener: () => void) => void;
        removeListener: (listener: () => void) => void;
      };
      legacyQuery.addListener(handler);
      return () => legacyQuery.removeListener(handler);
    };

    const updateViewportVars = () => {
      if (viewportRaf !== null) cancelAnimationFrame(viewportRaf);

      viewportRaf = requestAnimationFrame(() => {
        const root = document.documentElement;
        const viewport = window.visualViewport;
        const height = Math.round(viewport?.height || window.innerHeight);
        const width = Math.round(viewport?.width || window.innerWidth);
        const offsetTop = Math.round(viewport?.offsetTop || 0);
        const keyboardInset = Math.max(0, Math.round(window.innerHeight - height - offsetTop));
        const isStandalone = isStandaloneDisplay();

        root.style.setProperty('--app-height', `${height}px`);
        root.style.setProperty('--app-width', `${width}px`);
        root.style.setProperty('--app-viewport-top', `${offsetTop}px`);
        root.style.setProperty('--app-keyboard-inset', `${keyboardInset}px`);
        root.classList.toggle('pwa-standalone', isStandalone);
        root.classList.toggle('virtual-keyboard-open', isStandalone && keyboardInset > 80);

        if (isStandalone) {
          if (window.scrollX !== 0 || window.scrollY !== 0) {
            window.scrollTo(0, 0);
          }
          root.scrollTop = 0;
          document.body.scrollTop = 0;
        }

        viewportRaf = null;
      });
    };

    const settleViewportVars = () => {
      updateViewportVars();
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      settleTimers = [
        window.setTimeout(updateViewportVars, 80),
        window.setTimeout(updateViewportVars, 250),
        window.setTimeout(updateViewportVars, 500),
      ];
    };

    updateViewportVars();
    window.addEventListener('resize', updateViewportVars);
    window.addEventListener('orientationchange', settleViewportVars);
    window.addEventListener('focusin', settleViewportVars);
    window.addEventListener('focusout', settleViewportVars);
    window.visualViewport?.addEventListener('resize', updateViewportVars);
    window.visualViewport?.addEventListener('scroll', updateViewportVars);
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
    const removeStandaloneQueryListener = addMediaQueryListener(standaloneQuery, updateViewportVars);
    const removeFullscreenQueryListener = addMediaQueryListener(fullscreenQuery, updateViewportVars);

    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('PWA Service Worker registered with scope:', registration.scope);

          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((error) => {
          console.error('PWA Service Worker registration failed:', error);
        });

      let refreshing = false;
      const handleControllerChange = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      removeControllerChange = () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    }

    // 2. Check if already dismissed
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('eduverse-pwa-dismissed') === 'true';

      // 3. Detect Standalone Mode
      const isStandalone = isStandaloneDisplay();

      // 4. Handle Standard PWA Install Prompt (Chrome, Edge, Android)
      if (!isDismissed && !isStandalone) {
        handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          setShowPrompt(true);
        };
        handleAppInstalled = () => {
          setDeferredPrompt(null);
          setShowPrompt(false);
          setShowIOSPrompt(false);
          localStorage.setItem('eduverse-pwa-dismissed', 'true');
          document.documentElement.classList.add('pwa-standalone');
          updateViewportVars();
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // 5. Handle iOS Custom Prompt Detection
        const isIOSDevice = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase());
        if (isIOSDevice) {
          // Show iOS instructions for installation
          window.setTimeout(() => setShowIOSPrompt(true), 0);
        }
      }
    }

    return () => {
      if (handleBeforeInstallPrompt) window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (handleAppInstalled) window.removeEventListener('appinstalled', handleAppInstalled);
      removeControllerChange?.();
      window.removeEventListener('resize', updateViewportVars);
      window.removeEventListener('orientationchange', settleViewportVars);
      window.removeEventListener('focusin', settleViewportVars);
      window.removeEventListener('focusout', settleViewportVars);
      window.visualViewport?.removeEventListener('resize', updateViewportVars);
      window.visualViewport?.removeEventListener('scroll', updateViewportVars);
      removeStandaloneQueryListener();
      removeFullscreenQueryListener();
      settleTimers.forEach((timer) => window.clearTimeout(timer));
      if (viewportRaf !== null) cancelAnimationFrame(viewportRaf);
    };
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
