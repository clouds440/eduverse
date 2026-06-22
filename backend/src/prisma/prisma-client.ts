import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
export { Prisma, PrismaClient } from '../generated/prisma/client';
export * from '../generated/prisma/client';

type PrismaClientOptions = ConstructorParameters<typeof PrismaClient>[0];

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize PrismaClient.');
  }

  return databaseUrl;
}

export function createPrismaClientOptions(): PrismaClientOptions {
  return {
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  };
}

export function createPrismaClient() {
  return new PrismaClient(createPrismaClientOptions());
}
