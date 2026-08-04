import { Logger } from '@nestjs/common';
import { configuredOrigins } from './origin-policy';

type Environment = NodeJS.ProcessEnv;

const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLOUDINARY_URL',
  'FRONTEND_URL',
  'PORT',
  'BCRYPT_ROUNDS',
] as const;

const RECOMMENDED_ENV = [
  'THROTTLE_TTL',
  'THROTTLE_LIMIT',
  'DATABASE_POOL_MAX',
  'DATABASE_POOL_IDLE_TIMEOUT_MS',
  'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SUPER_ADMIN_EMAIL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'AI_API_KEY',
  'AI_API_BASE_URL',
  'AI_APP_URL',
  'AI_APP_NAME',
  'AI_MODEL',
  'AI_TEMPERATURE',
  'AI_MAX_RETRIES',
  'AI_COST_PER_1K_TOKENS',
  'LEMON_SQUEEZY_API_KEY',
  'LEMON_SQUEEZY_STORE_ID',
  'LEMON_SQUEEZY_WEBHOOK_SECRET',
] as const;

export function environmentErrors(env: Environment): string[] {
  const errors = REQUIRED_ENV.filter((name) => !env[name]).map(
    (name) => `${name} is required`,
  );

  const bootstrapAdmin = parseBoolean(env.BOOTSTRAP_SUPER_ADMIN);
  if (bootstrapAdmin === null) {
    errors.push('BOOTSTRAP_SUPER_ADMIN must be true or false when provided');
  } else if (bootstrapAdmin) {
    for (const name of [
      'SUPER_ADMIN_USERNAME',
      'SUPER_ADMIN_PASSWORD',
      'SUPER_ADMIN_EMAIL',
    ]) {
      if (!env[name])
        errors.push(`${name} is required when BOOTSTRAP_SUPER_ADMIN=true`);
    }
  }

  validateInteger(env.PORT, 'PORT', 1, 65_535, errors);
  validateInteger(env.BCRYPT_ROUNDS, 'BCRYPT_ROUNDS', 10, 15, errors);
  validateOptionalPositiveInteger(env.THROTTLE_TTL, 'THROTTLE_TTL', errors);
  validateOptionalPositiveInteger(env.THROTTLE_LIMIT, 'THROTTLE_LIMIT', errors);
  validateOptionalPositiveInteger(
    env.DATABASE_POOL_MAX,
    'DATABASE_POOL_MAX',
    errors,
  );
  validateOptionalPositiveInteger(
    env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    'DATABASE_POOL_IDLE_TIMEOUT_MS',
    errors,
  );
  validateOptionalPositiveInteger(
    env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    'DATABASE_POOL_CONNECTION_TIMEOUT_MS',
    errors,
  );

  try {
    const databaseUrl = new URL(env.DATABASE_URL || '');
    if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
      errors.push('DATABASE_URL must use the postgres or postgresql protocol');
    }
  } catch {
    errors.push('DATABASE_URL must be a valid PostgreSQL URL');
  }

  let frontendOrigins: string[] = [];
  try {
    frontendOrigins = configuredOrigins(env.FRONTEND_URL);
    if (frontendOrigins.length === 0)
      errors.push('FRONTEND_URL must contain at least one origin');
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'FRONTEND_URL is invalid',
    );
  }

  const sameSite = env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  if (sameSite && !['lax', 'strict', 'none'].includes(sameSite)) {
    errors.push('AUTH_COOKIE_SAME_SITE must be lax, strict, or none');
  }

  const cookieSecure = parseBoolean(env.AUTH_COOKIE_SECURE);
  if (cookieSecure === null) {
    errors.push('AUTH_COOKIE_SECURE must be true or false when provided');
  }

  if (env.NODE_ENV === 'production') {
    if ((env.JWT_SECRET || '').length < 32) {
      errors.push(
        'JWT_SECRET must contain at least 32 characters in production',
      );
    }
    if (cookieSecure !== true) {
      errors.push('AUTH_COOKIE_SECURE must be true in production');
    }
    if (
      frontendOrigins.some((origin) => new URL(origin).protocol !== 'https:')
    ) {
      errors.push('FRONTEND_URL must use HTTPS in production');
    }
    if (
      frontendOrigins.some((origin) =>
        ['localhost', '127.0.0.1', '::1'].includes(new URL(origin).hostname),
      )
    ) {
      errors.push('FRONTEND_URL cannot use a loopback host in production');
    }
  }

  return [...new Set(errors)];
}

export function validateEnv(env: Environment = process.env) {
  const logger = new Logger('EnvValidation');
  const errors = environmentErrors(env);
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n - ${errors.join('\n - ')}`,
    );
  }

  const missingRecommended = RECOMMENDED_ENV.filter((name) => !env[name]);
  if (missingRecommended.length > 0) {
    logger.warn(
      `Optional integrations are not fully configured: ${missingRecommended.join(', ')}`,
    );
  }

  if (env.LEMON_SQUEEZY_API_KEY && !env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    logger.warn(
      'LEMON_SQUEEZY_API_KEY is configured without LEMON_SQUEEZY_WEBHOOK_SECRET.',
    );
  }
}

export function validateReleaseEnv(env: Environment = process.env) {
  if (env.NODE_ENV !== 'production') {
    throw new Error('NODE_ENV must be production for release validation');
  }
  validateEnv(env);
}

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined || value === '') return false;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return null;
}

function validateInteger(
  value: string | undefined,
  name: string,
  minimum: number,
  maximum: number,
  errors: string[],
) {
  if (!value) return;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    errors.push(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

function validateOptionalPositiveInteger(
  value: string | undefined,
  name: string,
  errors: string[],
) {
  if (!value) return;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${name} must be a positive integer`);
  }
}
