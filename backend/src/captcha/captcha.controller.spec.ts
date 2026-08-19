import { BadRequestException } from '@nestjs/common';
import { CaptchaController } from './captcha.controller';

describe('CaptchaController', () => {
  const captcha = {
    createChallenge: jest.fn().mockResolvedValue({ token: 'challenge-token' }),
    redeemChallenge: jest.fn().mockResolvedValue({ success: true, token: 'captcha-token' }),
  };
  const controller = new CaptchaController(captcha as any);

  it('creates purpose-scoped challenges', async () => {
    await expect(controller.create('ORG_REGISTRATION')).resolves.toEqual({ token: 'challenge-token' });
    expect(captcha.createChallenge).toHaveBeenCalledWith('ORG_REGISTRATION');
  });

  it('passes solutions to Cap for redemption', async () => {
    const body = { token: 'challenge-token', solutions: [1] };
    await expect(controller.redeem('LOGIN', body)).resolves.toEqual({ success: true, token: 'captcha-token' });
    expect(captcha.redeemChallenge).toHaveBeenCalledWith('LOGIN', body);
  });

  it('rejects unknown purposes', () => {
    expect(() => controller.create('UNKNOWN')).toThrow(BadRequestException);
  });
});
