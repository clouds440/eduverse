import { environmentErrors, validateReleaseEnv } from './env-validation';

const validEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@db.example/eduverse',
  JWT_SECRET: 'a-production-secret-with-at-least-32-characters',
  CLOUDINARY_URL: 'cloudinary://key:secret@example',
  FRONTEND_URL: 'https://school.example',
  PORT: '3000',
  BCRYPT_ROUNDS: '12',
  AUTH_COOKIE_SECURE: 'true',
  AUTH_COOKIE_SAME_SITE: 'none',
};

describe('environment validation', () => {
  it('accepts a production-safe core environment', () => {
    expect(environmentErrors(validEnvironment)).toEqual([]);
  });

  it('prevents release validation under a non-production environment', () => {
    expect(() =>
      validateReleaseEnv({ ...validEnvironment, NODE_ENV: 'development' }),
    ).toThrow('NODE_ENV must be production for release validation');
  });

  it('requires bootstrap credentials only when provisioning is enabled', () => {
    expect(
      environmentErrors({
        ...validEnvironment,
        BOOTSTRAP_SUPER_ADMIN: 'true',
      }),
    ).toEqual(
      expect.arrayContaining([
        'SUPER_ADMIN_USERNAME is required when BOOTSTRAP_SUPER_ADMIN=true',
        'SUPER_ADMIN_PASSWORD is required when BOOTSTRAP_SUPER_ADMIN=true',
        'SUPER_ADMIN_EMAIL is required when BOOTSTRAP_SUPER_ADMIN=true',
      ]),
    );
    expect(environmentErrors(validEnvironment)).toEqual([]);
  });

  it('rejects weak production auth and non-HTTPS or loopback origins', () => {
    const errors = environmentErrors({
      ...validEnvironment,
      JWT_SECRET: 'short',
      FRONTEND_URL: 'http://localhost:3001',
      AUTH_COOKIE_SECURE: 'false',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'JWT_SECRET must contain at least 32 characters in production',
        'AUTH_COOKIE_SECURE must be true in production',
        'FRONTEND_URL must use HTTPS in production',
        'FRONTEND_URL cannot use a loopback host in production',
      ]),
    );
  });

  it('validates numeric bounds and enum-like settings', () => {
    const errors = environmentErrors({
      ...validEnvironment,
      PORT: '70000',
      BCRYPT_ROUNDS: '4',
      THROTTLE_LIMIT: '0',
      AUTH_COOKIE_SAME_SITE: 'sometimes',
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'PORT must be an integer between 1 and 65535',
        'BCRYPT_ROUNDS must be an integer between 10 and 15',
        'THROTTLE_LIMIT must be a positive integer',
        'AUTH_COOKIE_SAME_SITE must be lax, strict, or none',
      ]),
    );
  });
});
