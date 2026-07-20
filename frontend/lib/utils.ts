import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { normalizeSafeUrl } from './safeUrl';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const DEFAULT_SECTION_COLOR = '#3B82F6';

export const SECTION_COLOR_PALETTE = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Violet
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#F97316', // Orange
    '#14B8A6', // Teal
    '#6366F1', // Indigo
    '#84CC16', // Lime
    '#0EA5E9', // Sky
    '#F43F5E', // Rose
    '#D946EF', // Fuchsia
    '#64748B', // Slate
    '#B45309', // Dark Amber
    '#059669', // Dark Emerald
    '#0284C7', // Dark Sky
    '#BE185D', // Dark Pink
    '#7C3AED', // Dark Violet
    '#1D4ED8', // Dark Blue
    '#B91C1C', // Dark Red
    '#0F766E', // Dark Teal
    '#4F46E5', // Dark Indigo
    '#9333EA', // Purple
    '#475569', // Dark Slate
    '#EA580C', // Orange-600
    '#E11D48', // Rose-600
    '#C084FC', // Light Purple
    '#38BDF8', // Light Sky
    '#818CF8', // Light Indigo
    '#FB7185', // Light Rose
] as const;


type SectionColorInput = string | null | undefined | { color?: string | null };

function resolveSectionColorInput(color: SectionColorInput): string | null | undefined {
    return typeof color === 'object' && color !== null ? color.color : color;
}

export function isValidHexColor(color: string | null | undefined): color is string {
    return typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function isSectionPaletteColor(color: string | null | undefined): color is typeof SECTION_COLOR_PALETTE[number] {
    return isValidHexColor(color) && SECTION_COLOR_PALETTE.includes(color.toUpperCase() as typeof SECTION_COLOR_PALETTE[number]);
}

export function getSectionColor(color: SectionColorInput): string {
    const resolvedColor = resolveSectionColorInput(color);
    return isValidHexColor(resolvedColor) ? resolvedColor.toUpperCase() : DEFAULT_SECTION_COLOR;
}

export function getSectionTextStyle(color: SectionColorInput) {
    return { color: getSectionColor(color) };
}

export function getSectionSurfaceStyle(
    color: SectionColorInput,
    backgroundAlpha = '14',
    borderAlpha = '4D',
) {
    const sectionColor = getSectionColor(color);
    return {
        backgroundColor: `${sectionColor}${backgroundAlpha}`,
        borderColor: `${sectionColor}${borderAlpha}`,
    };
}

export function getSectionTintStyle(color: SectionColorInput) {
    const sectionColor = getSectionColor(color);
    return {
        ...getSectionSurfaceStyle(sectionColor, '18', '66'),
        color: sectionColor,
    };
}

export function formatCourseSectionLabel({
    sectionCode,
    sectionName,
}: {
    courseCode?: string | null;
    courseName?: string | null;
    sectionCode?: string | null;
    sectionName?: string | null;
}) {
    return sectionName || sectionCode || 'Unnamed section';
}

export function getCourseSectionLabelParts({
    sectionCode,
    sectionName,
}: {
    courseCode?: string | null;
    courseName?: string | null;
    sectionCode?: string | null;
    sectionName?: string | null;
}) {
    return {
        courseName: null,
        sectionName: sectionName || sectionCode || null,
        sectionCode: sectionCode || null,
        inlineLabel: formatCourseSectionLabel({ sectionCode, sectionName }),
    };
}

export function formatDepartmentLabel(department?: { name?: string | null; code?: string | null } | null) {
    if (!department) return 'Unassigned department';
    return department.code ? `${department.code} - ${department.name || 'Unnamed department'}` : department.name || 'Unnamed department';
}

export function formatBuildingLabel(building?: { name?: string | null; code?: string | null } | null) {
    if (!building) return 'Unassigned building';
    return building.code ? `${building.code} - ${building.name || 'Unnamed building'}` : building.name || 'Unnamed building';
}

export function formatRoomLabel(room?: {
    name?: string | null;
    code?: string | null;
    building?: { name?: string | null; code?: string | null } | null;
} | null) {
    if (!room) return 'Room TBD';
    const roomName = room.name || 'Unnamed room';
    const roomLabel = room.code ? `${room.code} - ${roomName}` : roomName;
    if (!room.building) return roomLabel;
    return `${room.building.code || room.building.name || 'Unnamed building'} / ${roomLabel}`;
}

/**
 * Standardizes image and file URLs by prepending the base API URL 
 * and handling fallbacks and cache-busting timestamps.
 */
export function getPublicUrl(path: string | null | undefined, updatedAt?: string | Date | null): string {
    if (!path) return '';

    // If it's already a full URL, only return safe http(s) URLs.
    if (path.startsWith('http')) return normalizeSafeUrl(path, { allowRelative: false }) || '';

    // Frontend static assets (like /assets/) should be returned as-is
    if (path.startsWith('/assets/')) return path;

    // Get API URL from env and strip /api to get the base server URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
    if (!apiUrl) {
        return normalizedPathWithTimestamp(path, updatedAt);
    }
    const baseUrl = apiUrl.replace(/\/api$/, '');

    // Ensure path starts with a slash if it doesn't already have one
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    let finalUrl = `${baseUrl}${normalizedPath}`;

    // Append timestamp for cache busting if provided (mostly for local files)
    if (updatedAt) {
        const date = new Date(updatedAt);
        if (!isNaN(date.getTime())) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + `t=${date.getTime()}`;
        }
    }

    return finalUrl;
}

function normalizedPathWithTimestamp(path: string, updatedAt?: string | Date | null): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (!updatedAt) {
        return normalizedPath;
    }

    const date = new Date(updatedAt);
    if (isNaN(date.getTime())) {
        return normalizedPath;
    }

    return `${normalizedPath}${normalizedPath.includes('?') ? '&' : '?'}t=${date.getTime()}`;
}

export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// FNV-1a hash function for consistent color selection
const fnv1aHash = (str: string) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
};

/**
 * Get a consistent color for a user based on their ID
 * Uses HSL color space with distinct hues to ensure super distinct colors
 * and minimize the chance of collisions (theoretical max: 360 unique hues)
 */
export function getUserColor(userId: string | undefined | null): string {
    const seed = userId || 'anon';
    const hash = fnv1aHash(seed);

    // Use the hash to select a distinct hue (0-359)
    // We use modulo 360 to ensure we get a valid hue value
    const hue = hash % 360;

    // Use high saturation and lightness for vibrant, distinct colors
    // Saturation: 70-80% for vibrant colors
    // Lightness: 45-55% for good contrast on both light and dark backgrounds
    const saturation = 75 + (hash % 10); // 75-85%
    const lightness = 45 + (hash % 15); // 45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Download a file from a URL by fetching it as a blob and triggering a download
 * This forces the browser to download the file instead of opening it
 */
export async function downloadFile(url: string, filename: string, token?: string | null): Promise<void> {
    try {
        const resolvedUrl = url.startsWith('/') ? getPublicUrl(url) : url;
        const safeUrl = normalizeSafeUrl(resolvedUrl, { allowRelative: true });
        if (!safeUrl) throw new Error('Unsafe download URL');
        const response = await fetch(safeUrl, {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error(`Download failed with ${response.status}`);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filenameWithExtension(filename, safeUrl, blob.type || response.headers.get('content-type'));
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 0);
    } catch (error) {
        console.error('Failed to download file:', error);
        throw error;
    }
}

const EXTENSION_BY_MIME: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/vnd.rar': '.rar',
    'text/plain': '.txt',
};

function filenameWithExtension(filename: string, url: string, contentType: string | null): string {
    const trimmed = filename.trim() || 'download';
    if (/\.[a-z0-9]{1,10}$/i.test(trimmed)) return trimmed;

    const normalizedContentType = contentType?.split(';')[0]?.trim().toLowerCase();
    const extensionFromType = normalizedContentType ? EXTENSION_BY_MIME[normalizedContentType] : '';
    if (extensionFromType) return `${trimmed}${extensionFromType}`;

    try {
        const extensionFromUrl = new URL(url, window.location.origin).pathname.match(/\.[a-z0-9]{1,10}$/i)?.[0];
        if (extensionFromUrl) return `${trimmed}${extensionFromUrl}`;
    } catch {
        // Keep the provided filename if the URL cannot be parsed.
    }

    return trimmed;
}

/**
 * Format bytes to a human-readable string (e.g. 1.2 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
    if (bytes <= 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}



