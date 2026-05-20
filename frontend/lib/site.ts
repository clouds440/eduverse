export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');

export function getSiteUrl() {
    if (!SITE_URL) {
        throw new Error('NEXT_PUBLIC_APP_URL environment variable is not set');
    }

    return SITE_URL;
}
