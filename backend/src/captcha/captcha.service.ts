import { BadRequestException, Injectable } from '@nestjs/common';
import Cap = require('@cap.js/server');
import type { RedeemCaptchaDto } from './captcha.dto';
import { CAPTCHA_PURPOSES, type CaptchaPurpose } from './captcha.types';

@Injectable()
export class CaptchaService {
  private readonly instances = new Map<CaptchaPurpose, Cap>(
    CAPTCHA_PURPOSES.map((purpose) => [purpose, new Cap({ noFSState: true })]),
  );

  createChallenge(purpose: CaptchaPurpose) {
    return this.instance(purpose).createChallenge();
  }

  async redeemChallenge(purpose: CaptchaPurpose, solution: RedeemCaptchaDto) {
    const result = await this.instance(purpose).redeemChallenge(solution);
    return result.success ? result : { ...result, error: result.message || 'Invalid CAPTCHA solution' };
  }

  async verifyToken(purpose: CaptchaPurpose, token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException('Complete the human verification challenge');
    }

    const result = await this.instance(purpose).validateToken(token.trim());
    if (!result.success) {
      throw new BadRequestException('Human verification is invalid or expired');
    }
  }

  private instance(purpose: CaptchaPurpose) {
    return this.instances.get(purpose)!;
  }
}
