'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, setUnauthorizedHandler } from '@/lib/api';
import { Role } from '@/types';
import { useGlobal, JwtPayload } from './GlobalContext';
import { PLATFORM_NAME, DASHBOARD_MODULES } from '@/lib/constants';
import { clearChatSession } from '@/lib/chatStore';
import { disconnectSocket } from '@/hooks/useSocket';
import { Loading } from '@/components/ui/Loading';
import { decodeAuthToken } from '@/lib/authSession';
import { unsubscribeCurrentWebPushSubscription } from '@/lib/webPush';
import { getRoleDashboardPath, getRoleLabel } from '@/lib/roles';

export type { JwtPayload };

interface AuthContextType {
    token: string | null;
    user: JwtPayload | null;
    loading: boolean;
    login: (token?: string | null) => Promise<void>;
    logout: () => void;
    updateUser: (data: Partial<JwtPayload>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { state, dispatch } = useGlobal();
    const { token, user, loading } = state.auth;
    const router = useRouter();
    const pathname = usePathname();

    const logout = React.useCallback(async () => {
        const currentToken = token;
        if (currentToken) {
            unsubscribeCurrentWebPushSubscription(currentToken).catch(() => { });
        }
        localStorage.removeItem('themeMode');
        clearChatSession();
        disconnectSocket();
        dispatch({ type: 'AUTH_LOGOUT' });
        router.replace('/login');
        api.auth.logout(currentToken || undefined).catch(() => { });
    }, [token, router, dispatch]);

    const processToken = React.useCallback((t: string) => {
        try {
            const decoded = decodeAuthToken(t);

            if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                return false;
            }

            dispatch({ type: 'AUTH_SET_SESSION', payload: { user: decoded, token: t } });
            return true;
        } catch (error) {
            console.warn('Invalid token', error);
            return false;
        }
    }, [dispatch]);

    // Register global 401 handler
    useEffect(() => {
        setUnauthorizedHandler((failedToken) => {
            // Only trigger if the failure was for our actual current in-memory token
            // This prevents race conditions when switching accounts
            if (token && (!failedToken || failedToken === token)) {
                clearChatSession();
                disconnectSocket();
                dispatch({ type: 'AUTH_LOGOUT' });
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Your session has expired. Please log in again.', type: 'info' } });
                router.replace('/login');
            }
        });
    }, [dispatch, router, token]);

    useEffect(() => {
        if (!loading) {
            const segments = pathname?.split('/').filter(Boolean) || [];

            const isAdminPath = segments[0] === 'admin';
            const isGuestPath = segments.length === 1 && (segments[0] === 'login' || segments[0] === 'register');
            // A path is considered a "User/Dashboard" path if:
            // 1. It starts with /admin (Platform Admin)
            // 2. It has at least 1 segment and the first segment is a known dashboard module
            const isUserPath = isAdminPath || (segments.length >= 1 && DASHBOARD_MODULES.includes(segments[0]));

            if (user) {
                // Enforce password change on first login for all roles
                if (user.isFirstLogin) {
                    const changePasswordPath = (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN)
                        ? '/admin/change-password'
                        : '/change-password';

                    if (pathname !== changePasswordPath) {
                        router.replace(changePasswordPath);
                        return;
                    }
                }

                if (isGuestPath) {
                    router.replace(getRoleDashboardPath(user));
                    return;
                }

                if (isAdminPath && user.role !== Role.SUPER_ADMIN && user.role !== Role.PLATFORM_ADMIN) {
                    router.replace('/');
                    return;
                }

                if (isUserPath && (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN)) {
                    // Only redirect if they are NOT on an admin path (meaning they are on an org path)
                    if (!isAdminPath) {
                        router.replace('/admin');
                        return;
                    }
                }

                if (isUserPath) {
                    const pathSegments = pathname.split('/');

                    if (user.role === Role.STUDENT) {
                        const isStudentPortal = pathSegments[1] === 'students' && pathSegments[2] === user.id;
                        const isSupportInOrg = pathSegments[1] === 'mail';
                        const isAllowedShared = ['chat', 'timetable', 'attendance', 'change-password', 'course-materials', 'transcripts', 'fees', 'profiles'].includes(pathSegments[1]);
                        const isSettingsPage = pathSegments.includes('settings');

                        if (isSettingsPage) {
                            // Settings page handles its own redirect, no toast needed
                            router.replace(`/students/${user.id}?tab=profile`);
                            return;
                        }

                        if (!isStudentPortal && !isSupportInOrg && !isAllowedShared) {
                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Students can only access their own student portal and shared school tools.', type: 'error' } });
                            router.replace(`/students/${user.id}`);
                            return;
                        }
                    } else if (user.role === Role.GUARDIAN) {
                        const isAllowedShared = ['guardian', 'chat', 'mail', 'change-password', 'profiles'].includes(pathSegments[1]);
                        if (!isAllowedShared) {
                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Guardians can only access linked-student information and support tools.', type: 'error' } });
                            router.replace('/guardian');
                            return;
                        }
                    } else if (user.role === Role.SUB_ADMIN) {
                        const usersChildRoute = pathSegments[1] === 'users' ? pathSegments[2] : pathSegments[1];
                        const isOwnSubAdminProfile = pathSegments[1] === 'sub-admins' && pathSegments[2] === user.id && pathSegments[3] === 'profile';
                        const isSettingsPage = pathSegments[1] === 'settings';
                        const isMainAdminOnlyPage = (usersChildRoute === 'sub-admins' && !isOwnSubAdminProfile) || isSettingsPage;
                        const isAllowedShared = [
                            'overview',
                            'users',
                            'sub-admins',
                            'buildings-and-rooms',
                            'departments',
                            'courses',
                            'academic-cycles',
                            'cohorts',
                            'sections',
                            'teachers',
                            'students',
                            'guardians',
                            'attendance',
                            'schedules',
                            'transcripts',
                            'promotions',
                            'grade-finalization',
                            'finance',
                            'teacher-finance',
                            'finance-managers',
                            'chat',
                            'mail',
                            'change-password',
                            'contact',
                            'profiles',
                        ].includes(pathSegments[1]);

                        if (isSettingsPage) {
                            router.replace(`/sub-admins/${user.id}/profile`);
                            return;
                        }

                        if (isMainAdminOnlyPage || !isAllowedShared) {
                            dispatch({ type: 'TOAST_ADD', payload: { message: isMainAdminOnlyPage ? 'Only the main admin can access that area.' : 'Sub Admins can only access delegated organization tools.', type: 'error' } });
                            router.replace('/overview');
                            return;
                        }
                    } else if (user.role === Role.FINANCE_MANAGER) {
                        const isAllowedShared = ['finance', 'teacher-finance', 'finance-managers', 'chat', 'mail', 'change-password', 'contact', 'profiles'].includes(pathSegments[1]);
                        const isSettingsPage = pathSegments.includes('settings');

                        if (isSettingsPage || !isAllowedShared) {
                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Finance Managers can only access finance and support tools.', type: 'error' } });
                            router.replace('/finance');
                            return;
                        }
                    } else if (user.role === Role.ORG_MANAGER) {
                        const isSettingsPage = pathSegments.includes('settings');
                        const isFinancePage = pathSegments[1] === 'finance';
                        const isTeacherManagementPage = pathSegments[1] === 'teachers' && (!pathSegments[2] || pathSegments[2] === 'add' || pathSegments[2] === 'edit');
                        const isStudentManagementPage = pathSegments[1] === 'students' && pathSegments[2] === 'add';
                        const isSectionManagementPage = pathSegments[1] === 'sections' && (pathSegments[2] === 'create' || pathSegments[2] === 'edit');
                        const isOrgManagementPage = ['users', 'courses', 'academic-cycles', 'cohorts', 'promotions', 'schedules', 'sub-admins', 'finance-managers', 'guardians'].includes(pathSegments[1]);
                        if (isSettingsPage) {
                            // Settings page handles its own redirect, no toast needed
                            router.replace(`/teachers/${user.id}/profile`);
                            return;
                        }
                        if (isFinancePage || isTeacherManagementPage || isStudentManagementPage || isSectionManagementPage || isOrgManagementPage) {
                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Managers can only access assigned academic sections and related academic tools.', type: 'error' } });
                            router.replace(`/teachers/${user.id}`);
                            return;
                        }
                    } else if (user.role === Role.TEACHER) {
                        const isTeacherList = pathSegments[1] === 'teachers' && !pathSegments[2];
                        const isSettingsPage = pathSegments.includes('settings');
                        const isGradeFinalizationPage = pathSegments[1] === 'grade-finalization';
                        if (isSettingsPage) {
                            // Settings page handles its own redirect, no toast needed
                            router.replace(`/teachers/${user.id}/profile`);
                            return;
                        }
                        if (isTeacherList || isGradeFinalizationPage) {
                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Teachers can only access their assigned teaching workspace.', type: 'error' } });
                            router.replace(`/teachers/${user.id}`);
                            return;
                        }
                    }
                }
            } else if (isAdminPath || isUserPath) {
                router.replace('/login');
            }
        }
    }, [user, loading, pathname, router, dispatch]);

    useEffect(() => {
        if (loading) return;
        if (!user) { document.title = PLATFORM_NAME; return; }
        const orgSuffix = user.orgName || PLATFORM_NAME;
        const roleLabel = getRoleLabel(user.role);
        switch (user.role) {
            case Role.SUPER_ADMIN:
            case Role.PLATFORM_ADMIN: document.title = `${roleLabel} - ${PLATFORM_NAME}`; break;
            case Role.ORG_ADMIN: document.title = `${roleLabel} - ${orgSuffix}`; break;
            case Role.SUB_ADMIN:
            case Role.FINANCE_MANAGER:
            case Role.ORG_MANAGER:
            case Role.TEACHER:
            case Role.STUDENT:
            case Role.GUARDIAN: document.title = `${user.name || roleLabel} - ${orgSuffix}`; break;
            default: document.title = orgSuffix;
        }
    }, [user, loading, pathname]);

    const login = React.useCallback(async (newToken?: string | null) => {
        if (newToken && processToken(newToken)) return;

        const session = await api.auth.session();
        if (session?.access_token && processToken(session.access_token)) return;

        throw new Error('Login succeeded, but the browser did not restore the session cookie.');
    }, [processToken]);
    const updateUser = (data: Partial<JwtPayload>) => dispatch({ type: 'AUTH_UPDATE_USER', payload: data });

    return (
        <AuthContext.Provider value={{ token, user, loading, login, logout, updateUser }}>
            {loading ?
                <Loading size='xl' fullScreen={true} /> : children
            }
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}
