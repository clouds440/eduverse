const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

interface SafeUrlOptions {
    allowRelative?: boolean;
    allowHttpLocalhost?: boolean;
    allowMailTo?: boolean;
    allowTel?: boolean;
}

const defaultOptions: Required<SafeUrlOptions> = {
    allowRelative: true,
    allowHttpLocalhost: true,
    allowMailTo: false,
    allowTel: false,
};

export function normalizeSafeUrl(value: string | null | undefined, options: SafeUrlOptions = {}): string | null {
    if (!value) return null;

    const opts = { ...defaultOptions, ...options };
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (opts.allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
        return trimmed;
    }

    const candidate = trimmed.startsWith('www.') ? `https://${trimmed}` : trimmed;

    try {
        const url = new URL(candidate);

        if (url.protocol === 'https:') return url.href;
        if (url.protocol === 'http:' && opts.allowHttpLocalhost && LOCALHOST_HOSTS.has(url.hostname)) {
            return url.href;
        }
        if (url.protocol === 'mailto:' && opts.allowMailTo) return url.href;
        if (url.protocol === 'tel:' && opts.allowTel) return url.href;
        if (url.protocol === 'blob:') return url.href;
    } catch {
        return null;
    }

    return null;
}

export function isSafeHttpUrl(value: string | null | undefined): boolean {
    return normalizeSafeUrl(value, { allowRelative: false }) !== null;
}
