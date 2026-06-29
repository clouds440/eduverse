export const PROFANITY_WARNING_EVENT = 'eduverse:profanity-warning';
export const PROFANITY_ERROR_CODE = 'PROFANITY_DETECTED';

export interface ProfanityWarningDetail {
    field?: string;
    fieldLabel?: string;
    matches?: string[];
    message: string;
}

export function isProfanityMessage(message?: string) {
    return Boolean(message && /profanity|inappropriate language/i.test(message));
}

export function emitProfanityWarning(detail: ProfanityWarningDetail) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<ProfanityWarningDetail>(PROFANITY_WARNING_EVENT, { detail: normalizeProfanityWarning(detail) }));
}

export function formatProfanityField(field?: string) {
    if (!field) return undefined;

    const rowMatch = field.match(/^rows\[(\d+)\](?:\.(?:data|raw))?\.(.+)$/);
    if (rowMatch) {
        return `Row ${Number(rowMatch[1]) + 1} ${humanizePath(rowMatch[2])}`;
    }

    return humanizePath(field.replace(/^(body|query)\./, ''));
}

function normalizeProfanityWarning(detail: ProfanityWarningDetail): ProfanityWarningDetail {
    const fieldLabel = detail.fieldLabel || formatProfanityField(detail.field);
    const message = fieldLabel && detail.field
        ? detail.message.replace(`"${detail.field}"`, fieldLabel)
        : detail.message;

    return {
        ...detail,
        fieldLabel,
        message,
    };
}

function humanizePath(path: string) {
    const labels = path
        .replace(/\[(\d+)\]/g, ' $1 ')
        .split('.')
        .filter((part) => part && part !== 'data' && part !== 'raw')
        .map(humanizeSegment);

    return labels.join(' ').trim() || path;
}

function humanizeSegment(segment: string) {
    const withSpaces = segment
        .replace(/Id$/i, '')
        .replace(/Ids$/i, 's')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim();

    return withSpaces.toLowerCase();
}
