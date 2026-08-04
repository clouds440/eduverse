import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProgramOfferingsController } from './program-offerings.controller';
import { ProgramOfferingsService } from './program-offerings.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProgramOfferingsController],
  providers: [ProgramOfferingsService],
})
export class ProgramOfferingsModule {}
