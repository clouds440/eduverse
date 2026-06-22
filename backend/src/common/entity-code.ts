export const ENTITY_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function normalizeEntityCode(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

export function normalizeRequiredEntityCode(value?: string | null) {
  return normalizeEntityCode(value) || '';
}
