'use client';

import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));

        const timer = setTimeout(() => {
            setIsVisible(false);
            // Wait for exit animation to complete before removing
            setTimeout(() => onClose(id), 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => onClose(id), 200);
    };

    const icons = {
        success: <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />,
        error: <XCircle className="w-5 h-5 md:w-6 md:h-6" />,
        info: <Info className="w-5 h-5 md:w-6 md:h-6" />
    };

    const backgrounds = {
        success: 'bg-success/80 border-success/80',
        error: 'bg-danger/80 border-danger/80',
        info: 'bg-info/80 border-info/80'
    };

    return (
        <div
            className={`flex items-center z-999 gap-3 md:gap-4 p-3 md:p-4 mb-3 text-white rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-500 pointer-events-auto max-w-sm w-full ${backgrounds[type]} ${isVisible ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95'
                }`}
        >
            <div className="shrink-0 p-2 bg-foreground/10 rounded-xl shadow-sm">{icons[type]}</div>
            <p className="font-semibold text-sm md:text-base flex-1 wrap-break-word">{message}</p>
            <button
                onClick={handleClose}
                className="shrink-0 p-1.5 hover:bg-foreground/10 rounded-xl transition-all active:scale-90"
                title="Dismiss"
            >
                <X className="w-4 h-4 md:w-5 md:h-5 opacity-60" />
            </button>
        </div>
    );
}
