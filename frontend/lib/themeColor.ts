import { ThemeMode } from '@/types';

export const DEFAULT_PRIMARY = '#0052FF';
export const DEFAULT_SECONDARY = '#5B616E';
export const THEME_PRIMARY_STORAGE_KEY = 'eduverse:last-valid-primary';

export function normalizeHexColor(value: string | null | undefined) {
    if (!value) return null;

    const trimmed = value.trim();
    const match = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(trimmed);
    if (!match) return null;

    const raw = match[1];
    const normalized = raw.length === 3
        ? raw.split('').map((char) => char + char).join('')
        : raw;

    return `#${normalized.toUpperCase()}`;
}

export function hexToRgb(hex: string) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return null;

    return {
        r: parseInt(normalized.slice(1, 3), 16),
        g: parseInt(normalized.slice(3, 5), 16),
        b: parseInt(normalized.slice(5, 7), 16),
    };
}

export function isPrimaryColorAllowed(value: string | null | undefined) {
    return !!normalizeHexColor(value);
}

export function getSafePrimaryColor(value: string | null | undefined) {
    const normalized = normalizeHexColor(value);
    return normalized ? normalized : DEFAULT_PRIMARY;
}

export function getPrimaryColorError(value: string | null | undefined) {
    return null;
}

export function getBrightness(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

export function getPerceivedBrightness(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    return Math.sqrt(
        rgb.r * rgb.r * 0.299 +
        rgb.g * rgb.g * 0.587 +
        rgb.b * rgb.b * 0.114
    );
}

export function getColorSaturation(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;

    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);

    return max === 0 ? 0 : (max - min) / max;
}

function getRelativeLuminance(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
        const srgb = channel / 255;
        return srgb <= 0.03928
            ? srgb / 12.92
            : Math.pow((srgb + 0.055) / 1.055, 2.4);
    });

    return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function getContrastRatio(colorA: string, colorB: string) {
    const luminanceA = getRelativeLuminance(colorA);
    const luminanceB = getRelativeLuminance(colorB);
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);

    return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastColor(hex: string) {
    const yiq = getBrightness(hex);
    return yiq >= 128 ? '#111827' : '#ffffff';
}

export function isColorTooBright(hex: string, threshold: number = 100) {
    return getBrightness(hex) > threshold;
}

export function isBlueShade(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    return rgb.b > rgb.r && rgb.b > rgb.g;
}

export function adjustBrightness(hex: string, percent: number) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const amount = Math.floor(255 * (percent / 100));
    const r = Math.min(255, Math.max(0, rgb.r + amount));
    const g = Math.min(255, Math.max(0, rgb.g + amount));
    const b = Math.min(255, Math.max(0, rgb.b + amount));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

export function getDerivedSecondaryColor(primary: string, mode: ThemeMode) {
    return mode === ThemeMode.DARK
        ? adjustBrightness(primary, -85)
        : adjustBrightness(primary, 90);
}

export function getPrimaryHoverColor(primary: string) {
    const safePrimary = getSafePrimaryColor(primary);
    const brightness = getBrightness(safePrimary);
    return adjustBrightness(safePrimary, brightness < 90 ? 12 : -12);
}
