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

  // Log optional but recommended envs. Some are required only when their feature is used.
  const recommendedEnvs = [
    'THROTTLE_TTL',
    'THROTTLE_LIMIT',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
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
  ];
  const missingRecommended = recommendedEnvs.filter((env) => !process.env[env]);
  const missingBillingVariants = lemonSqueezyVariantEnvGroups()
    .filter((group) => !group.some((env) => process.env[env]))
    .map((group) => group[0]);
  if (missingRecommended.length > 0) {
    logger.warn(
      'Recommended environment variables are missing. Related features may use defaults or stay unavailable:',
    );
    missingRecommended.forEach((env) => logger.warn(` - ${env}`));
  }
  if (missingBillingVariants.length > 0) {
    logger.warn('Lemon Squeezy AI billing variant envs are missing. Set the Lemon Squeezy variant IDs:');
    missingBillingVariants.forEach((env) => logger.warn(` - ${env}`));
  }

  if (!process.env.AI_API_KEY) {
    logger.warn('AI_API_KEY is required for EduVerse AI Copilot responses. Use an OpenRouter API key when AI_API_BASE_URL points to OpenRouter.');
  }

  if (!process.env.AI_MODEL) {
    logger.warn('AI_MODEL is required for EduVerse AI Copilot responses.');
  }

  if (process.env.LEMON_SQUEEZY_API_KEY && !process.env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    logger.warn('LEMON_SQUEEZY_API_KEY is configured but LEMON_SQUEEZY_WEBHOOK_SECRET is missing; AI billing webhooks will fail verification.');
  }

  warnAboutAuthCookieConfig(logger);
}

function lemonSqueezyVariantEnvGroups() {
  const plans = ['STARTER', 'GROWTH', 'SCALE'];
  const owners = ['ORG', 'PERSONAL'];
  return owners.flatMap((owner) => plans.map((plan) => [
    `LEMON_SQUEEZY_AI_${owner}_${plan}_VARIANT_ID`,
    `LEMON_SQUEEZY_AI_${plan}_VARIANT_ID`,
  ]));
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
