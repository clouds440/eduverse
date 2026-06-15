export const PREDEFINED_COLORS = [
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

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(color: string | undefined | null): color is string {
  return typeof color === 'string' && HEX_COLOR_PATTERN.test(color);
}

export function normalizeEntityColor(color: string | undefined | null, seed = '', fallbackDefault = '#3B82F6') {
  if (isValidHexColor(color)) return color.toUpperCase();

  if (!seed) return fallbackDefault;

  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  return PREDEFINED_COLORS[Math.abs(hash) % PREDEFINED_COLORS.length] || fallbackDefault;
}
