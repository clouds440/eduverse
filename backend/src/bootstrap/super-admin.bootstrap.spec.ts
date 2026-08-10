import { bootstrapSuperAdmin } from './super-admin.bootstrap';

describe('bootstrapSuperAdmin', () => {
  const env = {
    SUPER_ADMIN_USERNAME: 'root@example.test',
    SUPER_ADMIN_PASSWORD: 'StrongPassword123!',
    BCRYPT_ROUNDS: '10',
  };

  it('does nothing when credentials are not configured', async () => {
    const prisma = { user: { findFirst: jest.fn(), create: jest.fn() } };
    await expect(bootstrapSuperAdmin(prisma as never, {})).resolves.toBe(false);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('does not hash credentials when an admin already exists', async () => {
    const hash = jest.fn();
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-admin' }), create: jest.fn() } };

    await expect(
      bootstrapSuperAdmin(prisma as never, env, undefined, hash),
    ).resolves.toBe(false);
    expect(hash).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('serializes and creates the first admin once', async () => {
    const hash = jest.fn().mockResolvedValue('hashed-password');
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'new-admin' }) } };

    await expect(
      bootstrapSuperAdmin(prisma as never, env, undefined, hash),
    ).resolves.toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: env.SUPER_ADMIN_USERNAME,
        password: 'hashed-password',
      }),
    });
  });
});
