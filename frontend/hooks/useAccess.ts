import { useAuth } from '@/context/AuthContext';

export function useAccess() {
    const { user } = useAuth();
    
    // accessLevel: 0 (NONE), 1 (READ), 2 (WRITE)
    // Missing or legacy claims must fail closed in the UI.
    const accessLevel = user?.accessLevel ?? 0;
    
    return {
        accessLevel,
        canRead: accessLevel >= 1,
        canWrite: accessLevel >= 2,
        isBlocked: accessLevel === 0,
        userStatus: user?.userStatus,
    };
}
