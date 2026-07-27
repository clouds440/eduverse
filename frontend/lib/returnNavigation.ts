export const RETURN_TO_PARAM = 'returnTo';

export function isSafeAppPath(value: string | null | undefined): value is string {
    return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
}

export function withReturnTo(destination: string, currentPath: string) {
    if (!isSafeAppPath(destination) || !isSafeAppPath(currentPath)) return destination;

    const url = new URL(destination, 'https://eduverse.local');
    url.searchParams.set(RETURN_TO_PARAM, currentPath);
    return `${url.pathname}${url.search}${url.hash}`;
}

