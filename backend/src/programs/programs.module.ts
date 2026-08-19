import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GpaModule } from '../gpa/gpa.module';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { EducationProvidersModule } from '../education-providers/education-providers.module';
import { ProgramCatalogService } from './program-catalog.service';

@Module({
  imports: [PrismaModule, GpaModule, EducationProvidersModule],
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramCatalogService],
  exports: [ProgramsService, ProgramCatalogService],
})
export class ProgramsModule {}
