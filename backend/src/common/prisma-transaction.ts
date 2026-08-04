import { ConflictException } from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

type SerializableOptions = {
  conflictMessage: string;
  maxAttempts?: number;
};

function adapterCause(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const cause = (error as { cause?: unknown }).cause;
  return cause && typeof cause === 'object'
    ? (cause as { originalCode?: string; kind?: string })
    : null;
}

function isSerializationConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  ) {
    return true;
  }
  const cause = adapterCause(error);
  return (
    cause?.originalCode === '40001' ||
    cause?.kind === 'TransactionWriteConflict'
  );
}

function isUniqueConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return true;
  }
  const cause = adapterCause(error);
  return (
    cause?.originalCode === '23505' ||
    cause?.kind === 'UniqueConstraintViolation'
  );
}

export async function runSerializableTransaction<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: SerializableOptions,
) {
  const maxAttempts = options.maxAttempts ?? 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (isSerializationConflict(error) && attempt < maxAttempts) {
        continue;
      }
      if (isUniqueConflict(error) || isSerializationConflict(error)) {
        throw new ConflictException(options.conflictMessage);
      }
      throw error;
    }
  }
  throw new ConflictException(options.conflictMessage);
}
