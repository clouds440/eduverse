import { Module } from '@nestjs/common';
import { CohortsService } from './cohorts.service';
import { CohortsController } from './cohorts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentProgramEnrollmentsModule } from '../student-program-enrollments/student-program-enrollments.module';
import { CourseResultSchemesModule } from '../course-result-schemes/course-result-schemes.module';

@Module({
  imports: [PrismaModule, StudentProgramEnrollmentsModule, CourseResultSchemesModule],
  controllers: [CohortsController],
  providers: [CohortsService],
  exports: [CohortsService],
})
export class CohortsModule {}
