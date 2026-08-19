import { BadRequestException } from '@nestjs/common';
import { HumanVerificationController } from './human-verification.controller';

describe('HumanVerificationController', () => {
  it('creates a challenge only for a supported purpose', async () => {
    const challenges: any = { createChallenge: jest.fn().mockResolvedValue({ challengeId: 'challenge-1' }) };
    const controller = new HumanVerificationController(challenges);

    await controller.create('ORG_REGISTRATION');
    expect(challenges.createChallenge).toHaveBeenCalledWith('ORG_REGISTRATION');
    expect(() => controller.create('PASSWORD_RESET')).toThrow(BadRequestException);
  });
});
