'use client';

import React, { createContext, useContext, useReducer, ReactNode, useEffect, useCallback } from 'react';
import { AdminStats, Role, Organization, Teacher, Student, Section, Course, ThemeMode } from '@/types';
import { Toast, ToastType } from '@/components/ui/Toast';

// --- Types ---

export interface JwtPayload {
    sub: string;
    id: string;
    email: string;
    orgId?: string | null;
    organizationId?: string | null;
    name?: string;
    orgName?: string;
    orgLogoUrl?: string | null;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
    role?: Role;
    designation?: string;
    type?: string;
    status?: string; // This maps to organization status
    userStatus?: string;
    accessLevel?: number;
    isFirstLogin?: boolean;
    userName?: string;
    themeMode?: ThemeMode;
    iat: number;
    exp: number;
}

export interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

export interface DataField {
    label: string;
    value: React.ReactNode;
    icon?: React.ElementType | string;
    fullWidth?: boolean;
}

export interface ModalConfig {
    isOpen: boolean;
    title: string;
    subtitle?: string;
    fields: DataField[];
    body?: React.ReactNode;
    bodyClassName?: string;
    actions?: React.ReactNode;
}

export interface GlobalState {
    auth: {
        user: JwtPayload | null;
        token: string | null;
        loading: boolean;
        userProfile: Teacher | Student | null;
    };
    stats: {
        admin: AdminStats | null;
        orgData: Organization | null;
        mail: { unread: number; total: number; countsByStatus?: Record<string, number> } | null;
        chat: { unread: number } | null;
    };
    toasts: ToastItem[];
    ui: {
        isSidebarExpanded: boolean;
        isMobileSidebarOpen: boolean;
        viewModal: ModalConfig;
        isLoading: boolean;
        processing: Record<string, boolean>;
    };
    data: {
        sections: Section[];
        courses: Course[];
    };
}

// --- Actions ---

type Action =
    | { type: 'AUTH_SET_SESSION'; payload: { user: JwtPayload; token: string } }
    | { type: 'AUTH_LOGOUT' }
    | { type: 'AUTH_UPDATE_USER'; payload: Partial<JwtPayload> }
    | { type: 'AUTH_SET_LOADING'; payload: boolean }
    | { type: 'AUTH_SET_PROFILE'; payload: Teacher | Student | null }
    | { type: 'STATS_SET_ADMIN'; payload: AdminStats }
    | { type: 'STATS_SET_ORG_DATA'; payload: Organization }
    | { type: 'STATS_SET_MAIL'; payload: { unread: number; total: number; countsByStatus?: Record<string, number> } }
    | { type: 'STATS_SET_CHAT'; payload: { unread: number } }
    | { type: 'TOAST_ADD'; payload: Omit<ToastItem, 'id'> }
    | { type: 'TOAST_REMOVE'; payload: string }
    | { type: 'UI_TOGGLE_SIDEBAR' }
    | { type: 'UI_SET_MOBILE_SIDEBAR'; payload: boolean }
    | { type: 'UI_SET_LOADING'; payload: boolean }
    | { type: 'UI_START_PROCESSING'; payload: string }
    | { type: 'UI_STOP_PROCESSING'; payload: string }
    | { type: 'UI_OPEN_VIEW_MODAL'; payload: Omit<ModalConfig, 'isOpen'> }
    | { type: 'UI_CLOSE_VIEW_MODAL' }
    | { type: 'DATA_SET_SECTIONS'; payload: Section[] }
    | { type: 'DATA_SET_COURSES'; payload: Course[] };

// --- Initial State ---

const initialState: GlobalState = {
    auth: {
        user: null,
        token: null,
        loading: true,
        userProfile: null,
    },
    stats: {
        admin: null,
        orgData: null,
        mail: null,
        chat: null,
    },
    toasts: [],
    ui: {
        isSidebarExpanded: true,
        isMobileSidebarOpen: false,
        isLoading: false,
        processing: {},
        viewModal: {
            isOpen: false,
            title: '',
            fields: [],
        },
    },
    data: {
        sections: [],
        courses: [],
    },
};

// --- Reducer ---

function globalReducer(state: GlobalState, action: Action): GlobalState {
    switch (action.type) {
        case 'AUTH_SET_SESSION':
            return {
                ...state,
                auth: { user: action.payload.user, token: action.payload.token, loading: false, userProfile: state.auth.userProfile }
            };
        case 'AUTH_LOGOUT':
            return {
                ...state,
                auth: { user: null, token: null, loading: false, userProfile: null },
                stats: { admin: null, orgData: null, mail: null, chat: null }
            };
        case 'AUTH_UPDATE_USER':
            return {
                ...state,
                auth: {
                    ...state.auth,
                    user: state.auth.user ? { ...state.auth.user, ...action.payload } : null
                }
            };
        case 'AUTH_SET_LOADING':
            if (state.auth.loading === action.payload) return state;
            return { ...state, auth: { ...state.auth, loading: action.payload } };
        case 'AUTH_SET_PROFILE':
            return { ...state, auth: { ...state.auth, userProfile: action.payload } };
        case 'STATS_SET_ADMIN':
            return {
                ...state,
                stats: {
                    ...state.stats,
                    admin: action.payload,
                    mail: { unread: action.payload.UNREAD_MAIL, total: action.payload.TOTAL_MAIL }
                }
            };
        case 'STATS_SET_ORG_DATA':
            return { ...state, stats: { ...state.stats, orgData: action.payload } };
        case 'STATS_SET_MAIL':
            return { ...state, stats: { ...state.stats, mail: action.payload } };
        case 'STATS_SET_CHAT':
            return { ...state, stats: { ...state.stats, chat: action.payload } };
        case 'TOAST_ADD':
            const id = Math.random().toString(36).substring(2, 9);
            return { ...state, toasts: [...state.toasts, { ...action.payload, id }] };
        case 'TOAST_REMOVE':
            return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        case 'UI_TOGGLE_SIDEBAR':
            return { ...state, ui: { ...state.ui, isSidebarExpanded: !state.ui.isSidebarExpanded } };
        case 'UI_SET_MOBILE_SIDEBAR':
            return { ...state, ui: { ...state.ui, isMobileSidebarOpen: action.payload } };
        case 'UI_SET_LOADING':
            if (state.ui.isLoading === action.payload) return state;
            return { ...state, ui: { ...state.ui, isLoading: action.payload } };
        case 'UI_START_PROCESSING':
            return {
                ...state,
                ui: {
                    ...state.ui,
                    processing: {
                        ...state.ui.processing,
                        [action.payload]: true
                    }
                }
            };
        case 'UI_STOP_PROCESSING':
            const updated = { ...state.ui.processing };
            delete updated[action.payload];
            return {
                ...state,
                ui: {
                    ...state.ui,
                    processing: updated
                }
            };
        case 'UI_OPEN_VIEW_MODAL':
            return { ...state, ui: { ...state.ui, viewModal: { ...action.payload, isOpen: true } } };
        case 'UI_CLOSE_VIEW_MODAL':
            return { ...state, ui: { ...state.ui, viewModal: { ...state.ui.viewModal, isOpen: false } } };
        case 'DATA_SET_SECTIONS':
            return { ...state, data: { ...state.data, sections: action.payload } };
        case 'DATA_SET_COURSES':
            return { ...state, data: { ...state.data, courses: action.payload } };
        default:
            return state;
    }
}

// --- Context ---

interface GlobalContextType {
    state: GlobalState;
    dispatch: React.Dispatch<Action>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(globalReducer, initialState);

    // Initial auth sync
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedSidebarState = localStorage.getItem('edu-sidebar-expanded');

        if (storedSidebarState !== null) {
            const isExpanded = storedSidebarState === 'true';
            if (isExpanded !== state.ui.isSidebarExpanded) {
                dispatch({ type: 'UI_TOGGLE_SIDEBAR' });
            }
        }

        if (storedToken) {
            try {
                const base64Url = storedToken.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(
                    atob(base64)
                        .split('')
                        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                        .join('')
                );
                const decoded = JSON.parse(jsonPayload) as JwtPayload;

                // Simple exp check
                if (decoded.exp * 1000 < Date.now()) {
                    localStorage.removeItem('token');
                    dispatch({ type: 'AUTH_LOGOUT' });
                } else {
                    if (decoded.name && !decoded.userName) {
                        decoded.userName = decoded.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
                    }
                    if (decoded.sub && !decoded.id) decoded.id = decoded.sub;

                    dispatch({ type: 'AUTH_SET_SESSION', payload: { user: decoded, token: storedToken } });
                }
            } catch {
                localStorage.removeItem('token');
                dispatch({ type: 'AUTH_SET_LOADING', payload: false });
            }
        } else {
            dispatch({ type: 'AUTH_SET_LOADING', payload: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const removeToast = useCallback((id: string) => {
        dispatch({ type: 'TOAST_REMOVE', payload: id });
    }, [dispatch]);

    return (
        <GlobalContext.Provider value={{ state, dispatch }}>
            {children}
            <div className="fixed bottom-4 right-4 z-500 flex flex-col items-end pointer-events-none">
                {state.toasts.map((toast) => (
                    <Toast
                        key={toast.id}
                        id={toast.id}
                        message={toast.message}
                        type={toast.type}
                        duration={toast.duration}
                        onClose={removeToast}
                    />
                ))}
            </div>
        </GlobalContext.Provider>
    );
}

export function useGlobal() {
    const context = useContext(GlobalContext);
    if (!context) throw new Error('useGlobal must be used within GlobalProvider');
    return context;
}
