'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { api, ApiRequestError } from '@/lib/api';
import type { HumanVerificationChallenge, HumanVerificationPurpose, HumanVerificationValue } from '@/types';
import { Button } from './Button';
import { Input } from './Input';
import { StatusBanner } from './StatusBanner';

export function HumanVerification({
    purpose,
    onChange,
    resetKey = 0,
    disabled = false,
}: {
    purpose: HumanVerificationPurpose;
    onChange: (value: HumanVerificationValue | null) => void;
    resetKey?: number;
    disabled?: boolean;
}) {
    const [challenge, setChallenge] = useState<HumanVerificationChallenge | null>(null);
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const loadChallenge = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setAnswer('');
        setChallenge(null);
        onChangeRef.current(null);
        try {
            const next = await api.humanVerification.createChallenge(purpose);
            setChallenge(next);
        } catch (err) {
            const unavailable = err instanceof ApiRequestError && (err.status === 404 || err.status >= 500);
            setError(unavailable
                ? 'Verification is temporarily unavailable. Please try again shortly.'
                : err instanceof ApiRequestError && err.status === 429
                    ? 'Too many verification requests. Please wait a moment and try again.'
                    : 'Verification challenge could not be loaded. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    }, [purpose]);

    useEffect(() => {
        void loadChallenge();
    }, [loadChallenge, resetKey]);

    const updateAnswer = (value: string) => {
        setAnswer(value);
        onChangeRef.current(challenge && value.trim() ? {
            challengeId: challenge.challengeId,
            challengeAnswer: value,
        } : null);
    };

    return (
        <div className="space-y-2 border-t border-border/70 pt-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-sm font-bold">Human verification</span>
                </div>
                <Button type="button" variant="ghost" size="sm" icon={RefreshCw} onClick={loadChallenge} disabled={disabled || isLoading} title="New challenge" aria-label="Load a new verification challenge" />
            </div>
            {error ? (
                <StatusBanner title="Verification unavailable" description={error} variant="danger" />
            ) : (
                <div className="grid stable-grid gap-2 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(10rem,1fr)] sm:items-center">
                    <div className="flex h-11 items-center justify-center rounded-md border border-border bg-muted/35 font-mono text-lg font-black" aria-live="polite">
                        {isLoading ? 'Loading...' : challenge?.prompt}
                    </div>
                    <Input
                        inputMode="numeric"
                        autoComplete="off"
                        value={answer}
                        onChange={(event) => updateAnswer(event.target.value)}
                        placeholder="Enter the answer"
                        aria-label="Human verification answer"
                        required
                        disabled={disabled || isLoading || !challenge}
                    />
                </div>
            )}
        </div>
    );
}
