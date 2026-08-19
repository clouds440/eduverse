import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProgramOfferingsController } from './program-offerings.controller';
import { ProgramOfferingsService } from './program-offerings.service';
import { AdminProgramOfferingsController } from './admin-program-offerings.controller';
import { AdminProgramOfferingsService } from './admin-program-offerings.service';
import { EducationProvidersModule } from '../education-providers/education-providers.module';
import { ProgramOfferingCatalogService } from './program-offering-catalog.service';
import { CampusProgramOfferingBindingsService } from './campus-program-offering-bindings.service';

@Module({
  imports: [PrismaModule, EducationProvidersModule],
  controllers: [ProgramOfferingsController, AdminProgramOfferingsController],
  providers: [
    ProgramOfferingsService,
    AdminProgramOfferingsService,
    ProgramOfferingCatalogService,
    CampusProgramOfferingBindingsService,
  ],
  exports: [ProgramOfferingCatalogService, CampusProgramOfferingBindingsService],
})
export class ProgramOfferingsModule {}
