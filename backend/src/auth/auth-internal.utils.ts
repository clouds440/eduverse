import { createHash } from 'crypto';

export function hashSecret(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function getDetailsReason(details: unknown) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return null;
  }
  const reason = (details as { reason?: unknown }).reason;
  return typeof reason === 'string' ? reason : null;
}
