import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';
import { Role } from '../common/enums';
import type { Prisma, PrismaClient } from '../prisma/prisma-client';

type BootstrapPrisma = Pick<PrismaClient, '$transaction'>;
type PasswordHasher = (password: string, rounds: number) => Promise<string>;

export async function bootstrapSuperAdmin(
  prisma: BootstrapPrisma,
  env: NodeJS.ProcessEnv = process.env,
  logger = new Logger('SuperAdminBootstrap'),
  hashPassword: PasswordHasher = bcrypt.hash,
) {
  if (env.BOOTSTRAP_SUPER_ADMIN?.toLowerCase() !== 'true') return false;

  const email = env.SUPER_ADMIN_USERNAME!;
  const password = env.SUPER_ADMIN_PASSWORD!;
  const bcryptRounds = Number(env.BCRYPT_ROUNDS);

  return prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('eduverse-super-admin-bootstrap'))`;

    const existingAdmin = await transaction.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true },
    });
    if (existingAdmin) return false;

    const hashedPassword = await hashPassword(password, bcryptRounds);
    await transaction.user.create({
      data: {
        email,
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
        avatarUrl: '/assets/eduverse-icon-192.png',
        isFirstLogin: true,
      },
    });
    logger.log('Initial Super Admin created successfully');
    return true;
  });
}
