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

type Violation = {
  path: string;
};

function normalizeFieldName(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveField(value: string) {
  return SENSITIVE_FIELD_NAMES.has(normalizeFieldName(value));
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
      throw new BadRequestException({
        code: 'PROFANITY_DETECTED',
        field: violation.path,
        message: `Profanity is not allowed in "${violation.path}". Please revise it before submitting.`,
      });
    }

    return value;
  }

  private findViolation(value: unknown, path: string, seen: WeakSet<object>): Violation | null {
    if (typeof value === 'string') {
      return checkBadWords(value).okay ? null : { path };
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
      if (isSensitiveField(key)) {
        continue;
      }

      const nestedPath = path === 'body' || path === 'query' ? key : `${path}.${key}`;
      const violation = this.findViolation(nestedValue, nestedPath, seen);
      if (violation) return violation;
    }

    return null;
  }
}
