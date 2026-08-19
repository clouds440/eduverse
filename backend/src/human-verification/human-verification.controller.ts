import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { HumanVerificationService } from './human-verification.service';
import { HUMAN_VERIFICATION_PURPOSES, type HumanVerificationPurpose } from './human-verification.types';

@Public()
@Controller('public/human-verification')
export class HumanVerificationController {
  constructor(private readonly challenges: HumanVerificationService) {}

  @Get('challenge')
  @Throttle({ default: { limit: 20, ttl: 5 * 60_000 } })
  create(@Query('purpose') purpose?: string) {
    if (!purpose || !HUMAN_VERIFICATION_PURPOSES.includes(purpose as HumanVerificationPurpose)) {
      throw new BadRequestException('Unsupported human verification purpose');
    }
    return this.challenges.createChallenge(purpose as HumanVerificationPurpose);
  }
}
