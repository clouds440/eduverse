import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CourseResultSchemesService } from './course-result-schemes.service';
import { CourseResultAggregationService } from './course-result-aggregation.service';
import { StudentProgramEnrollmentsModule } from '../student-program-enrollments/student-program-enrollments.module';

@Module({
  imports: [PrismaModule, StudentProgramEnrollmentsModule],
  providers: [CourseResultSchemesService, CourseResultAggregationService],
  exports: [CourseResultSchemesService, CourseResultAggregationService],
})
export class CourseResultSchemesModule {}
