import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';
import { Role } from '../common/enums';
import type { PrismaClient } from '../prisma/prisma-client';

type BootstrapPrisma = Pick<PrismaClient, 'user'>;
type PasswordHasher = (password: string, rounds: number) => Promise<string>;

export async function bootstrapSuperAdmin(
  prisma: BootstrapPrisma,
  env: NodeJS.ProcessEnv = process.env,
  logger = new Logger('SuperAdminBootstrap'),
  hashPassword: PasswordHasher = bcrypt.hash,
): Promise<boolean> {
  const email = env.SUPER_ADMIN_USERNAME;
  const password = env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    logger.warn(
      'SUPER_ADMIN_USERNAME or SUPER_ADMIN_PASSWORD is missing. Skipping Super Admin bootstrap.',
    );
    return false;
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: Role.SUPER_ADMIN,
    },
    select: {
      id: true,
    },
  });

  if (existingAdmin) {
    return false;
  }

  const bcryptRounds = Number(env.BCRYPT_ROUNDS);

  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 4) {
    throw new Error('BCRYPT_ROUNDS must be a valid integer of at least 4.');
  }

  const hashedPassword = await hashPassword(password, bcryptRounds);

  await prisma.user.create({
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
}
