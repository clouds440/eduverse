import { Global, Module } from '@nestjs/common';
import { HumanVerificationController } from './human-verification.controller';
import { HumanVerificationService } from './human-verification.service';

@Global()
@Module({
  controllers: [HumanVerificationController],
  providers: [HumanVerificationService],
  exports: [HumanVerificationService],
})
export class HumanVerificationModule {}
