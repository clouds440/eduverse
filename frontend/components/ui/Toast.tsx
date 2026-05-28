'use client';

import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

export function Toast({ id, message, type, duration = 2000, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let removeTimer: number | undefined;
        const enterTimer = window.setTimeout(() => setIsVisible(true), 0);

        const exitTimer = window.setTimeout(() => {
            setIsVisible(false);
            removeTimer = window.setTimeout(() => onClose(id), 250);
        }, duration);

        return () => {
            window.clearTimeout(enterTimer);
            window.clearTimeout(exitTimer);
            if (removeTimer) window.clearTimeout(removeTimer);
        };
    }, [id, duration, onClose]);

    const handleClose = () => {
        setIsVisible(false);
        window.setTimeout(() => onClose(id), 200);
    };

    const icons = {
        success: <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />,
        error: <XCircle className="w-5 h-5 md:w-6 md:h-6" />,
        info: <Info className="w-5 h-5 md:w-6 md:h-6" />
    };

    const backgrounds = {
        success: 'border-success/25 bg-success text-white',
        error: 'border-danger/25 bg-danger text-white',
        info: 'border-info/25 bg-info text-white'
    };

    return (
        <div
            className={cn(
                "pointer-events-auto mb-2 flex w-full items-start gap-3 rounded-lg border p-3 shadow-lg shadow-black/15 backdrop-blur-sm",
                "transition-all duration-200 motion-reduce:transition-none sm:max-w-sm",
                backgrounds[type],
                isVisible ? "translate-y-0 opacity-100 sm:translate-x-0" : "translate-y-3 opacity-0 sm:translate-x-8 sm:translate-y-0",
            )}
            role={type === 'error' ? 'alert' : 'status'}
            aria-live={type === 'error' ? 'assertive' : 'polite'}
        >
            <div className="shrink-0 rounded-md bg-white/10 p-1.5" aria-hidden="true">{icons[type]}</div>
            <p className="flex-1 wrap-break-word text-sm font-semibold leading-5">{message}</p>
            <button
                onClick={handleClose}
                className="shrink-0 rounded-md p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                title="Dismiss"
                aria-label="Dismiss notification"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
