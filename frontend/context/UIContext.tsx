'use client';

import React, { createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useGlobal, ModalConfig, DataField } from './GlobalContext';
import { useBackStackEntry } from './BackNavigationContext';

export type { DataField };

interface UIContextType {
    isExpanded: boolean;
    isMobileOpen: boolean;
    isDesktop: boolean;
    mounted: boolean;
    toggleSidebar: () => void;
    toggleMobileSidebar: () => void;
    setIsMobileOpen: (open: boolean) => void;
    modalConfig: ModalConfig;
    openViewModal: (config: Omit<ModalConfig, 'isOpen'>) => void;
    closeViewModal: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const { state, dispatch } = useGlobal();
    const { isSidebarExpanded: isExpanded, isMobileSidebarOpen: isMobileOpen, viewModal: modalConfig } = state.ui;
    
    const pathname = usePathname();
    const [isDesktop, setIsDesktop] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);

    // Handle viewport tracking and hydration
    React.useEffect(() => {
        setMounted(true);
        const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handle route change reset
    React.useEffect(() => {
        dispatch({ type: 'UI_SET_MOBILE_SIDEBAR', payload: false });
    }, [pathname, dispatch]);

    useBackStackEntry({
        enabled: mounted && !isDesktop && isMobileOpen,
        label: 'Mobile sidebar',
        priority: 20,
        onBack: () => dispatch({ type: 'UI_SET_MOBILE_SIDEBAR', payload: false }),
    });

    const toggleSidebar = () => {
        const newState = !isExpanded;
        localStorage.setItem('edu-sidebar-expanded', String(newState));
        dispatch({ type: 'UI_TOGGLE_SIDEBAR' });
    };
    const toggleMobileSidebar = () => dispatch({ type: 'UI_SET_MOBILE_SIDEBAR', payload: !isMobileOpen });
    const setIsMobileOpen = (open: boolean) => dispatch({ type: 'UI_SET_MOBILE_SIDEBAR', payload: open });

    const openViewModal = (config: Omit<ModalConfig, 'isOpen'>) => {
        dispatch({ type: 'UI_OPEN_VIEW_MODAL', payload: config });
    };

    const closeViewModal = () => {
        dispatch({ type: 'UI_CLOSE_VIEW_MODAL' });
    };

    return (
        <UIContext.Provider value={{
            isExpanded,
            isMobileOpen,
            isDesktop,
            mounted,
            toggleSidebar,
            toggleMobileSidebar,
            setIsMobileOpen,
            modalConfig,
            openViewModal,
            closeViewModal
        }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
}
