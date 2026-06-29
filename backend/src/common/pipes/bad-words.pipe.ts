import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { checkBadWords } from '../bad-words.util';

const SENSITIVE_FIELD_NAMES = new Set([
  'authorization',
  'currentpassword',
  'newpassword',
  'oldpassword',
  'password',
  'passwordconfirmation',
  'refreshtoken',
  'resettoken',
  'token',
  'verificationcode',
]);

const TECHNICAL_FIELD_SUFFIXES = [
  'id',
  'ids',
  'url',
  'uri',
  'uuid',
];

type Violation = {
  path: string;
  matches: string[];
};

function normalizeFieldName(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveField(value: string) {
  return SENSITIVE_FIELD_NAMES.has(normalizeFieldName(value));
}

function isTechnicalField(value: string) {
  const normalized = normalizeFieldName(value);
  if (TECHNICAL_FIELD_SUFFIXES.includes(normalized)) return true;
  return /(?:^|[A-Z_-])ids?$/i.test(value) || /(?:^|[A-Z_-])uuids?$/i.test(value);
}

function shouldSkipField(value: string) {
  return isSensitiveField(value) || isTechnicalField(value);
}

function isStructuredString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) return true;
  if (/^(?:true|false|null|undefined|yes|no|y|n)$/i.test(trimmed)) return true;
  if (/^\d{4}-\d{2}-\d{2}(?:[tT ][\d:.+-]+Z?)?$/.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !Buffer.isBuffer(value);
}

@Injectable()
export class BadWordsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!['body', 'query'].includes(metadata.type)) {
      return value;
    }

    const violation = this.findViolation(value, metadata.data || metadata.type, new WeakSet<object>());

    if (violation) {
      const blockedWords = violation.matches.map((match) => `"${match}"`).join(', ');
      throw new BadRequestException({
        code: 'PROFANITY_DETECTED',
        field: violation.path,
        matches: violation.matches,
        message: `Profanity is not allowed in "${violation.path}"${blockedWords ? ` (${blockedWords})` : ''}. Please revise it before submitting.`,
      });
    }

    return value;
  }

  private findViolation(value: unknown, path: string, seen: WeakSet<object>): Violation | null {
    if (typeof value === 'string') {
      if (isStructuredString(value)) return null;
      const result = checkBadWords(value);
      return result.okay ? null : { path, matches: result.matches };
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const violation = this.findViolation(value[index], `${path}[${index}]`, seen);
        if (violation) return violation;
      }

      return null;
    }

    if (!isRecord(value)) {
      return null;
    }

    if (seen.has(value)) {
      return null;
    }

    seen.add(value);

    for (const [key, nestedValue] of Object.entries(value)) {
      if (shouldSkipField(key)) {
        continue;
      }

      const nestedPath = path === 'body' || path === 'query' ? key : `${path}.${key}`;
      const violation = this.findViolation(nestedValue, nestedPath, seen);
      if (violation) return violation;
    }

    return null;
  }
}
