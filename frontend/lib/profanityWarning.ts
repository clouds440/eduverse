export const PROFANITY_WARNING_EVENT = 'eduverse:profanity-warning';
export const PROFANITY_ERROR_CODE = 'PROFANITY_DETECTED';

export interface ProfanityWarningDetail {
    field?: string;
    message: string;
}

export function isProfanityMessage(message?: string) {
    return Boolean(message && /profanity|inappropriate language/i.test(message));
}

export function emitProfanityWarning(detail: ProfanityWarningDetail) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<ProfanityWarningDetail>(PROFANITY_WARNING_EVENT, { detail }));
}
