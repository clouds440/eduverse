import { Module } from '@nestjs/common';
import { AcademicCyclesService } from './academic-cycles.service';
import { AcademicCyclesController } from './academic-cycles.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { GpaModule } from '../gpa/gpa.module';

@Module({
  imports: [PrismaModule, GpaModule],
  controllers: [AcademicCyclesController],
  providers: [AcademicCyclesService],
  exports: [AcademicCyclesService],
})
export class AcademicCyclesModule {}
