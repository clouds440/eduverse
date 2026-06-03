export const DEFAULT_SECTION_COLOR = '#3B82F6';

export const SECTION_COLOR_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#06B6D4',
  '#EC4899',
  '#84CC16',
] as const;

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(color: string | undefined | null): color is string {
  return typeof color === 'string' && HEX_COLOR_PATTERN.test(color);
}

export function normalizeSectionColor(color: string | undefined | null, seed = '') {
  if (isValidHexColor(color)) return color.toUpperCase();

  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(index);
    hash |= 0;
  }

  return SECTION_COLOR_PALETTE[Math.abs(hash) % SECTION_COLOR_PALETTE.length] || DEFAULT_SECTION_COLOR;
}
