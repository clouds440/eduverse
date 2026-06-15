/**
 * SWR Cache Key Types and Utilities
 * Provides type-safe cache key handling for SWR's mutate function
 */

// All possible cache key prefixes used in the application
export type CacheKeyPrefix =
    | 'platform-admins'
    | 'admin-organizations'
    | 'admin-audit-logs'
    | 'mails'
    | 'teachers'
    | 'sub-admins'
    | 'sub-admin'
    | 'finance-managers'
    | 'finance-manager'
    | 'guardians'
    | 'guardian'
    | 'students'
    | 'sections'
    | 'courses'
    | 'assessment-detail'
    | 'timetable'
    | 'teacher'
    | 'student'
    | 'grades'
    | 'assessments'
    | 'insights'
    | 'attendance'
    | 'range-attendance'
    | 'schedules'
    | 'enrollments'
    | 'grades-detail'
    | 'submissions'
    | 'attendance-session'
    | 'notifications'
    | 'chats'
    | 'messages'
    | 'unread-count'
    | 'academicCycles'
    | 'cohorts'
    | 'departments'
    | 'buildings'
    | 'rooms'
    | 'transcript'
    | 'studentsSearch';

// Cache key can be a string, an array with a prefix, or null
export type CacheKey = string | readonly [CacheKeyPrefix, ...unknown[]] | null;

// Type guard to check if a key is an array with a specific prefix
export function isCacheKeyWithPrefix(key: unknown, prefix: CacheKeyPrefix): key is readonly [CacheKeyPrefix, ...unknown[]] {
    return Array.isArray(key) && key.length > 0 && key[0] === prefix;
}

// Helper function to create a predicate for SWR mutate
// Usage: mutate(matchesCacheKeyPrefix('platform-admins'))
export function matchesCacheKeyPrefix(prefix: CacheKeyPrefix): (key: unknown) => boolean {
    return (key: unknown): boolean => isCacheKeyWithPrefix(key, prefix);
}

// Helper to match multiple prefixes
// Usage: mutate(matchesAnyCacheKeyPrefix(['teachers', 'students']))
export function matchesAnyCacheKeyPrefix(prefixes: CacheKeyPrefix[]): (key: unknown) => boolean {
    return (key: unknown): boolean => {
        if (!Array.isArray(key) || key.length === 0) return false;
        return prefixes.includes(key[0] as CacheKeyPrefix);
    };
}

// Helper to match keys that start with a given prefix
// Usage: mutate(matchesCacheKeyPrefixStartsWith('attendance-'))
export function matchesCacheKeyPrefixStartsWith(prefix: string): (key: unknown) => boolean {
    return (key: unknown): boolean => {
        if (!Array.isArray(key) || key.length === 0) return false;
        return typeof key[0] === 'string' && key[0].startsWith(prefix);
    };
}
