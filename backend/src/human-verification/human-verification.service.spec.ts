import { BadRequestException } from '@nestjs/common';
import { HumanVerificationService } from './human-verification.service';

function harness() {
  const prisma: any = {
    humanVerificationChallenge: {
      create: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const config: any = { get: jest.fn().mockReturnValue('test-secret') };
  return { service: new HumanVerificationService(prisma, config), prisma };
}

describe('HumanVerificationService', () => {
  it('creates a short-lived purpose-bound challenge without exposing its answer', async () => {
    const { service, prisma } = harness();
    const result = await service.createChallenge('ONLINE_ADMISSION');

    expect(result).toEqual(expect.objectContaining({ challengeId: 'challenge-1', prompt: expect.stringContaining('= ?') }));
    expect(result).not.toHaveProperty('answer');
    expect(prisma.humanVerificationChallenge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ answerHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    }));
  });

  it('consumes a correct challenge only once', async () => {
    const { service, prisma } = harness();
    const hash = (service as any).hashAnswer('challenge-1', '7');
    prisma.humanVerificationChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      purpose: 'LOGIN',
      answerHash: hash,
      attempts: 0,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await service.verify('LOGIN', { challengeId: 'challenge-1', challengeAnswer: ' 7 ' });
    expect(prisma.humanVerificationChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { usedAt: expect.any(Date) } }));
  });

  it('increments attempts and rejects an incorrect answer', async () => {
    const { service, prisma } = harness();
    prisma.humanVerificationChallenge.findUnique.mockResolvedValue({
      id: 'challenge-1',
      purpose: 'ORG_REGISTRATION',
      answerHash: '0'.repeat(64),
      attempts: 0,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.verify('ORG_REGISTRATION', {
      challengeId: 'challenge-1',
      challengeAnswer: '8',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.humanVerificationChallenge.update).toHaveBeenCalledWith(expect.objectContaining({ data: { attempts: { increment: 1 } } }));
  });
});
