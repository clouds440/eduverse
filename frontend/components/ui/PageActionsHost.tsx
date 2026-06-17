'use client';

import { createContext, useContext, useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react';

const PageActionsHostContext = createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);

export function PageActionsHostProvider({
    children,
    setActions,
}: {
    children: ReactNode;
    setActions: Dispatch<SetStateAction<ReactNode>>;
}) {
    return (
        <PageActionsHostContext.Provider value={setActions}>
            {children}
        </PageActionsHostContext.Provider>
    );
}

export function usePageActionsHost(actions: ReactNode) {
    const setActions = useContext(PageActionsHostContext);

    useEffect(() => {
        if (!setActions) return;
        setActions(actions);
        return () => setActions(null);
    }, [actions, setActions]);

    return Boolean(setActions);
}
