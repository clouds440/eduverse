import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { RedeemCaptchaDto } from './captcha.dto';
import { CaptchaService } from './captcha.service';
import { isCaptchaPurpose } from './captcha.types';

@Public()
@Controller('public/captcha/:purpose')
export class CaptchaController {
  constructor(private readonly captcha: CaptchaService) {}

  @Post('challenge')
  @Throttle({ default: { limit: 20, ttl: 5 * 60_000 } })
  create(@Param('purpose') purpose: string) {
    if (!isCaptchaPurpose(purpose)) throw new BadRequestException('Unsupported CAPTCHA purpose');
    return this.captcha.createChallenge(purpose);
  }

  @Post('redeem')
  @Throttle({ default: { limit: 30, ttl: 5 * 60_000 } })
  redeem(@Param('purpose') purpose: string, @Body() body: RedeemCaptchaDto) {
    if (!isCaptchaPurpose(purpose)) throw new BadRequestException('Unsupported CAPTCHA purpose');
    return this.captcha.redeemChallenge(purpose, body);
  }
}
