import { Module } from '@nestjs/common';
import { CohortsService } from './cohorts.service';
import { CohortsController } from './cohorts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentProgramEnrollmentsModule } from '../student-program-enrollments/student-program-enrollments.module';

@Module({
  imports: [PrismaModule, StudentProgramEnrollmentsModule],
  controllers: [CohortsController],
  providers: [CohortsService],
  exports: [CohortsService],
})
export class CohortsModule {}
