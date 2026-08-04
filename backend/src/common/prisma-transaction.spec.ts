import { ConflictException } from '@nestjs/common';
import { Prisma } from '@/prisma/prisma-client';
import { runSerializableTransaction } from './prisma-transaction';

describe('runSerializableTransaction', () => {
  const knownError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('phase11 transaction error', {
      code,
      clientVersion: 'phase11',
    });

  it('retries serialization failures and returns the eventual result', async () => {
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValueOnce(knownError('P2034'))
        .mockResolvedValueOnce('completed'),
    };

    await expect(
      runSerializableTransaction(prisma as never, jest.fn(), {
        conflictMessage: 'Concurrent change',
      }),
    ).resolves.toBe('completed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('retries adapter-level PostgreSQL serialization failures', async () => {
    const adapterError = Object.assign(new Error('TransactionWriteConflict'), {
      cause: {
        originalCode: '40001',
        kind: 'TransactionWriteConflict',
      },
    });
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValueOnce(adapterError)
        .mockResolvedValueOnce('completed'),
    };

    await expect(
      runSerializableTransaction(prisma as never, jest.fn(), {
        conflictMessage: 'Concurrent change',
      }),
    ).resolves.toBe('completed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('translates exhausted serialization and uniqueness conflicts to HTTP conflicts', async () => {
    for (const code of ['P2002', 'P2034']) {
      const prisma = {
        $transaction: jest.fn().mockRejectedValue(knownError(code)),
      };
      await expect(
        runSerializableTransaction(prisma as never, jest.fn(), {
          conflictMessage: 'Concurrent change',
          maxAttempts: 2,
        }),
      ).rejects.toEqual(new ConflictException('Concurrent change'));
    }
  });
});
