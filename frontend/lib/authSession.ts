import type { JwtPayload } from '@/context/GlobalContext';

export function decodeAuthToken(token: string): JwtPayload {
    const base64Url = token.split('.')[1];
    if (!base64Url) {
        throw new Error('Invalid auth token payload');
    }

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
        atob(base64)
            .split('')
            .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
            .join('')
    );
    const decoded = JSON.parse(jsonPayload) as JwtPayload;

    if (decoded.name) {
        decoded.userName = decoded.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    }
    if (decoded.sub && !decoded.id) decoded.id = decoded.sub;

    return decoded;
}

export function isAuthTokenExpired(token: string) {
    const decoded = decodeAuthToken(token);
    return !!decoded.exp && decoded.exp * 1000 < Date.now();
}
