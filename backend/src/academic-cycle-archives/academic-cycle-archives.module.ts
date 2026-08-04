import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AcademicCycleArchivesController } from './academic-cycle-archives.controller';
import { AcademicCycleArchivesService } from './academic-cycle-archives.service';

@Module({
  imports: [PrismaModule],
  controllers: [AcademicCycleArchivesController],
  providers: [AcademicCycleArchivesService],
  exports: [AcademicCycleArchivesService],
})
export class AcademicCycleArchivesModule {}
