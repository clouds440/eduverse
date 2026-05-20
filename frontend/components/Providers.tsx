'use client';

import { useEffect } from 'react';
import { AuthProvider } from "@/context/AuthContext";
import { UIProvider } from "@/context/UIContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { GlobalProvider } from "@/context/GlobalContext";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { initOfflineQueue } from '@/lib/offlineQueue';
import { API_BASE_URL } from '@/lib/api';
import { PushSubscriptionSync } from '@/components/ui/PushSubscriptionSync';

export function Providers({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        initOfflineQueue(API_BASE_URL);
    }, []);

    return (
        <GlobalProvider>
            <AuthProvider>
                <SWRProvider>
                    <ThemeProvider>
                        <UIProvider>
                            <PushSubscriptionSync />
                            {children}
                        </UIProvider>
                    </ThemeProvider>
                </SWRProvider>
            </AuthProvider>
        </GlobalProvider>
    );
}
