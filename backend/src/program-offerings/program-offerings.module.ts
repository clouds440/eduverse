import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProgramOfferingsController } from './program-offerings.controller';
import { ProgramOfferingsService } from './program-offerings.service';
import { AdminProgramOfferingsController } from './admin-program-offerings.controller';
import { AdminProgramOfferingsService } from './admin-program-offerings.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProgramOfferingsController, AdminProgramOfferingsController],
  providers: [ProgramOfferingsService, AdminProgramOfferingsService],
})
export class ProgramOfferingsModule {}
