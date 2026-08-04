import { bootstrapSuperAdmin } from './super-admin.bootstrap';

describe('bootstrapSuperAdmin', () => {
  const env = {
    BOOTSTRAP_SUPER_ADMIN: 'true',
    SUPER_ADMIN_USERNAME: 'root@example.test',
    SUPER_ADMIN_PASSWORD: 'StrongPassword123!',
    BCRYPT_ROUNDS: '10',
  };

  it('does nothing unless explicitly enabled', async () => {
    const prisma = { $transaction: jest.fn() };
    await expect(bootstrapSuperAdmin(prisma as never, {})).resolves.toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not hash credentials when an admin already exists', async () => {
    const hash = jest.fn();
    const transaction = {
      $queryRaw: jest.fn(),
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-admin' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((operation) => operation(transaction)),
    };

    await expect(
      bootstrapSuperAdmin(prisma as never, env, undefined, hash),
    ).resolves.toBe(false);
    expect(hash).not.toHaveBeenCalled();
    expect(transaction.user.create).not.toHaveBeenCalled();
  });

  it('serializes and creates the first admin once', async () => {
    const hash = jest.fn().mockResolvedValue('hashed-password');
    const transaction = {
      $queryRaw: jest.fn(),
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'new-admin' }),
      },
    };
    const prisma = {
      $transaction: jest.fn((operation) => operation(transaction)),
    };

    await expect(
      bootstrapSuperAdmin(prisma as never, env, undefined, hash),
    ).resolves.toBe(true);
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: env.SUPER_ADMIN_USERNAME,
        password: 'hashed-password',
      }),
    });
  });
});
