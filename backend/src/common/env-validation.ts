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
}
