'use client';

import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react';

const FinanceHeaderActionsContext = createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);

export function FinanceHeaderActionsProvider({
    children,
    setActions,
}: {
    children: ReactNode;
    setActions: Dispatch<SetStateAction<ReactNode>>;
}) {
    return (
        <FinanceHeaderActionsContext.Provider value={setActions}>
            {children}
        </FinanceHeaderActionsContext.Provider>
    );
}

export function useFinanceHeaderActions() {
    const context = useContext(FinanceHeaderActionsContext);
    if (!context) {
        throw new Error('useFinanceHeaderActions must be used inside FinanceHeaderActionsProvider');
    }
    return context;
}
