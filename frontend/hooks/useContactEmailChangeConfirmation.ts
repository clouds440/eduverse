'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

type AuthorizedAction = (authorizedUntil: string | null) => void | Promise<void>;

export function useContactEmailChangeConfirmation(token?: string | null) {
    const [isOpen, setIsOpen] = useState(false);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isRequesting, setIsRequesting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const authorizedAction = useRef<AuthorizedAction | null>(null);

    const close = () => {
        if (isConfirming) return;
        setIsOpen(false);
        setCode('');
        setError(null);
        authorizedAction.current = null;
    };

    const request = async (onAuthorized: AuthorizedAction) => {
        if (!token) return;
        setIsRequesting(true);
        setError(null);
        authorizedAction.current = onAuthorized;
        try {
            const result = await api.auth.requestContactEmailChangeConfirmation(token);
            if (result.required === false) {
                await onAuthorized(null);
                authorizedAction.current = null;
                return;
            }
            setCode('');
            setIsOpen(true);
        } catch (requestError) {
            authorizedAction.current = null;
            setError(requestError instanceof Error ? requestError.message : 'Unable to send the confirmation code.');
            throw requestError;
        } finally {
            setIsRequesting(false);
        }
    };

    const confirm = async () => {
        if (!token || code.length !== 6) return;
        setIsConfirming(true);
        setError(null);
        try {
            const result = await api.auth.confirmContactEmailChange(code, token);
            const action = authorizedAction.current;
            setIsOpen(false);
            setCode('');
            authorizedAction.current = null;
            await action?.(result.authorizedUntil || null);
        } catch (confirmError) {
            setError(confirmError instanceof Error ? confirmError.message : 'Unable to confirm the code.');
        } finally {
            setIsConfirming(false);
        }
    };

    return {
        isOpen,
        code,
        error,
        isRequesting,
        isConfirming,
        setCode,
        request,
        confirm,
        close,
    };
}
