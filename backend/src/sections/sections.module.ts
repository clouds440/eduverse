import { Module } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CoursesModule } from '../courses/courses.module';
import { CourseResultSchemesModule } from '../course-result-schemes/course-result-schemes.module';

@Module({
  imports: [PrismaModule, CoursesModule, CourseResultSchemesModule],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
