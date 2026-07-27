'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import type { LinkedAccount } from '@/types';

export function useLinkedAccounts() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            setLinkedAccounts(await api.auth.getLinkedAccounts(token));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load linked accounts';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setLoading(false);
        }
    }, [dispatch, token]);

    useEffect(() => {
        if (!token || !user) return;
        void refresh();
    }, [refresh, token, user]);

    const googleAccount = useMemo(
        () => linkedAccounts.find((account) => account.provider === 'google') ?? null,
        [linkedAccounts],
    );

    return {
        linkedAccounts,
        googleAccount,
        loading,
        refresh,
    };
}
