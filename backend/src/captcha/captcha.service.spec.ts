import { BadRequestException } from '@nestjs/common';
import { CaptchaService } from './captcha.service';

describe('CaptchaService', () => {
  it('requires a token before validation', async () => {
    await expect(new CaptchaService().verifyToken('LOGIN')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects tokens Cap does not recognize', async () => {
    await expect(new CaptchaService().verifyToken('ONLINE_ADMISSION', 'invalid')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a challenge with Cap without filesystem state', async () => {
    const challenge = await new CaptchaService().createChallenge('ORG_REGISTRATION');
    expect(challenge).toEqual(expect.objectContaining({ token: expect.any(String), challenge: expect.any(Object), expires: expect.any(Number) }));
  });
});
