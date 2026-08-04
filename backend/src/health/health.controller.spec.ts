import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a minimal liveness response', () => {
    const controller = new HealthController({} as never);
    expect(controller.live()).toEqual({ status: 'ok' });
  });

  it('reports readiness only when the database responds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new HealthController(prisma as never);
    await expect(controller.ready()).resolves.toEqual({ status: 'ready' });
  });

  it('does not expose database failure details', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockRejectedValue(new Error('secret connection string')),
    };
    const controller = new HealthController(prisma as never);
    await expect(controller.ready()).rejects.toEqual(
      new ServiceUnavailableException({ status: 'unavailable' }),
    );
  });
});
