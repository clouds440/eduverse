export const ENTITY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

export function normalizeEntityCode(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function normalizeRequiredEntityCode(value?: string | null) {
  return normalizeEntityCode(value) || '';
}