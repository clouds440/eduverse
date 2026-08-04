import { createDatabasePoolConfig } from './prisma-client';

describe('database pool configuration', () => {
  it('uses bounded defaults suitable for replicated application instances', () => {
    expect(
      createDatabasePoolConfig({
        DATABASE_URL: 'postgresql://user:password@localhost/database',
      }),
    ).toEqual(
      expect.objectContaining({
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }),
    );
  });

  it('accepts explicit positive pool limits and ignores invalid values', () => {
    expect(
      createDatabasePoolConfig({
        DATABASE_URL: 'postgresql://user:password@localhost/database',
        DATABASE_POOL_MAX: '24',
        DATABASE_POOL_IDLE_TIMEOUT_MS: '45000',
        DATABASE_POOL_CONNECTION_TIMEOUT_MS: '-1',
      }),
    ).toEqual(
      expect.objectContaining({
        max: 24,
        idleTimeoutMillis: 45_000,
        connectionTimeoutMillis: 5_000,
      }),
    );
  });
});
