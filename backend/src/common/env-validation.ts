import { Logger } from '@nestjs/common';

/**
 * Validates that all required environment variables are present.
 * If any are missing, it logs a clear error and exits the process.
 */
export function validateEnv() {
  const logger = new Logger('EnvValidation');

  const requiredEnvs = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CLOUDINARY_URL',
    'FRONTEND_URL',
    'SUPER_ADMIN_USERNAME',
    'SUPER_ADMIN_PASSWORD',
    'PORT',
    'BCRYPT_ROUNDS',
  ];

  const missing = requiredEnvs.filter((env) => !process.env[env]);

  if (missing.length > 0) {
    logger.error('CRITICAL: Missing required environment variables!');
    missing.forEach((env) => logger.error(` - ${env} IS MISSING`));
    logger.error(
      'The application cannot start without these variables. Please check your .env file.',
    );
    process.exit(1);
  }

  // Log optional but recommended envs
  const recommendedEnvs = [
    'THROTTLE_TTL',
    'THROTTLE_LIMIT',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
  ];
  const missingRecommended = recommendedEnvs.filter((env) => !process.env[env]);
  if (missingRecommended.length > 0) {
    logger.warn(
      'Recommended environment variables are missing (using defaults):',
    );
    missingRecommended.forEach((env) => logger.warn(` - ${env}`));
  }

  warnAboutAuthCookieConfig(logger);
}

function warnAboutAuthCookieConfig(logger: Logger) {
  const frontendUrls = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  const isHttpsFrontend = frontendUrls.some((url) => {
    try {
      return new URL(url).protocol === 'https:';
    } catch {
      return false;
    }
  });

  const sameSite = process.env.AUTH_COOKIE_SAME_SITE?.toLowerCase();
  const secure = process.env.AUTH_COOKIE_SECURE;

  if (isHttpsFrontend && secure === 'false') {
    logger.warn(
      'AUTH_COOKIE_SECURE=false can prevent auth cookies from working with an HTTPS frontend.',
    );
  }

  if (isHttpsFrontend && sameSite && sameSite !== 'none') {
    logger.warn(
      'Cross-origin HTTPS frontends usually need AUTH_COOKIE_SAME_SITE=none for session restore after refresh.',
    );
  }
}
