import { PREDEFINED_COLORS, HEX_COLOR_PATTERN, isValidHexColor, normalizeEntityColor } from '../common/colors';

export const DEFAULT_SECTION_COLOR = '#3B82F6';

export const SECTION_COLOR_PALETTE = PREDEFINED_COLORS;

export { HEX_COLOR_PATTERN, isValidHexColor };

export function normalizeSectionColor(color: string | undefined | null, seed = '') {
  return normalizeEntityColor(color, seed, DEFAULT_SECTION_COLOR);
}
