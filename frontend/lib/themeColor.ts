import { ThemeMode } from '@/types';

export const DEFAULT_PRIMARY = '#0052FF';
export const DEFAULT_SECONDARY = '#5B616E';
export const THEME_PRIMARY_STORAGE_KEY = 'eduverse:last-valid-primary';

export const LIGHT_THEME_SURFACES = {
    background: '#EEF3F8',
    foreground: '#0B1220',
    cardBg: '#FFFFFF',
    cardText: '#0B1220',
    mutedBg: '#E5EAF1',
    mutedText: '#667085',
    accentBg: '#D9E2EC',
    accentText: '#111827',
    borderColor: '#CBD5E1',
    inputBg: '#F8FAFC',
    themeBg: '#EEF3F8',
    navbarBg: 'rgba(248, 250, 252, 0.86)',
    navbarText: '#050F1A',
    overlay: 'rgba(15, 23, 42, 0.62)',
    sidebarBg: '#FFFFFF',
    sidebarText: '#182235',
    sidebarSubtle: '#64748B',
    sidebarPanel: '#F4F7FB',
    sidebarHover: '#EDF4FF',
} as const;

export const DARK_THEME_SURFACES = {
    background: '#0D1117',
    foreground: '#F3F6FA',
    cardBg: '#151B24',
    cardText: '#F3F6FA',
    mutedBg: '#202938',
    mutedText: '#A5B4C6',
    accentBg: '#263244',
    accentText: '#E7EEF8',
    borderColor: 'rgba(164, 179, 198, 0.22)',
    inputBg: '#111821',
    themeBg: '#0A0E14',
    navbarBg: 'rgba(13, 17, 23, 0.9)',
    navbarText: '#F8FAFC',
    overlay: 'rgba(2, 6, 23, 0.72)',
    sidebarBg: '#101722',
    sidebarText: '#F4F7FB',
    sidebarSubtle: '#9AA8BA',
    sidebarPanel: '#172131',
    sidebarHover: '#1D2A3B',
} as const;

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

export function getPrimaryColorError(_value: string | null | undefined) {
    void _value;
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
