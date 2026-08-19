'use client';

import { createElement, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CaptchaPurpose } from '@/types';
import { StatusBanner } from './StatusBanner';

type CapWidgetElement = HTMLElement & {
    reset: () => void;
};

export function CapVerification({
    purpose,
    onChange,
    resetKey = 0,
    disabled = false,
    className,
}: {
    purpose: CaptchaPurpose;
    onChange: (token: string | null) => void;
    resetKey?: number;
    disabled?: boolean;
    className?: string;
}) {
    const widgetRef = useRef<CapWidgetElement | null>(null);
    const onChangeRef = useRef(onChange);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        let active = true;
        import('@cap.js/widget')
            .then(() => active && setIsReady(true))
            .catch(() => active && setError('Verification is temporarily unavailable. Please try again shortly.'));
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!isReady || !widgetRef.current) return;
        const widget = widgetRef.current;
        const handleSolve = (event: Event) => {
            const token = (event as CustomEvent<{ token?: string }>).detail?.token;
            setError('');
            onChangeRef.current(token || null);
        };
        const handleReset = () => onChangeRef.current(null);
        const handleError = () => {
            onChangeRef.current(null);
            setError('Verification could not be completed. Check your connection and try again.');
        };
        widget.addEventListener('solve', handleSolve);
        widget.addEventListener('reset', handleReset);
        widget.addEventListener('error', handleError);
        return () => {
            widget.removeEventListener('solve', handleSolve);
            widget.removeEventListener('reset', handleReset);
            widget.removeEventListener('error', handleError);
        };
    }, [isReady]);

    useEffect(() => {
        widgetRef.current?.reset();
        onChangeRef.current(null);
        setError('');
    }, [resetKey, purpose]);

    const endpoint = `${API_BASE_URL}/public/captcha/${purpose}/`;
    const widgetStyle = {
        display: 'block',
        width: '100%',
        '--cap-widget-width': '100%',
        '--cap-widget-height': '56px',
        '--cap-widget-padding': '14px 16px',
        '--cap-border-radius': '8px',
        '--cap-background': 'var(--card-bg)',
        '--cap-color': 'var(--card-text)',
        '--cap-border-color': 'var(--border-color)',
        '--cap-checkbox-background': 'var(--input-bg)',
        '--cap-checkbox-border': '1px solid var(--border-color)',
        '--cap-spinner-background-color': 'var(--muted-bg)',
        '--cap-spinner-color': 'var(--primary)',
        '--cap-focus-ring': 'var(--primary)',
        '--cap-troubleshoot-color': 'var(--primary)',
    } as CSSProperties;

    return (
        <div className={cn('w-full space-y-3', className)}>
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-sm font-bold">Human verification</span>
            </div>
            {error && <StatusBanner title="Verification unavailable" description={error} variant="danger" />}
            <div className={disabled ? 'pointer-events-none opacity-60' : undefined} aria-busy={!isReady}>
                {isReady
                    ? createElement('cap-widget', {
                        ref: (element: CapWidgetElement | null) => { widgetRef.current = element; },
                        'data-cap-api-endpoint': endpoint,
                        'data-cap-i18n-initial-state': 'Verify you are human',
                        'data-cap-i18n-verifying-label': 'Verifying...',
                        'data-cap-i18n-solved-label': 'Verified',
                        'data-cap-i18n-error-label': 'Try again',
                        style: widgetStyle,
                    })
                    : <div className="h-14 w-full animate-pulse rounded-lg border border-border bg-muted/35" />}
            </div>
        </div>
    );
}
