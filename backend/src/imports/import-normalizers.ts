import { BadRequestException } from '@nestjs/common';

export function optionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function nullableString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function requiredString(value: string | undefined, field: string) {
  const trimmed = optionalString(value);
  if (!trimmed) throw new BadRequestException(`${field} is required`);
  return trimmed;
}

function fieldError(message: string, field?: string) {
  if (!field) throw new BadRequestException(message);
  throw new BadRequestException({ field, message });
}

export function optionalNumber(value?: string | null, field?: string) {
  const text = optionalString(value);
  if (!text) return undefined;
  const number = Number(text);
  if (!Number.isFinite(number)) fieldError('Must be a valid number', field);
  return number;
}

export function optionalInteger(value?: string | null, field?: string) {
  const text = optionalString(value);
  if (!text) return undefined;
  const number = Number(text);
  if (!Number.isInteger(number)) fieldError('Must be a valid integer', field);
  return number;
}

export function optionalBoolean(value?: string | null, field?: string) {
  const text = optionalString(value);
  if (!text) return undefined;
  const normalized = text.toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  fieldError('Must be true or false', field);
}

export function optionalDate(value?: string | null, field?: string, message = 'Must be a valid date') {
  const text = optionalString(value);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) fieldError(message, field);
  return text;
}

export function optionalEnum<T extends string>(value: string | undefined, allowed: readonly T[], field?: string) {
  const text = optionalString(value);
  if (!text) return undefined;
  const match = allowed.find((item) => item.toLowerCase() === text.toLowerCase());
  if (!match) fieldError(`Must be one of: ${allowed.join(', ')}`, field);
  return match;
}

export function splitIds(value?: string | null) {
  const text = optionalString(value);
  if (!text) return undefined;
  const ids = text
    .split(';')
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}
