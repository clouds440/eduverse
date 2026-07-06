import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentModule } from '../students/student.module';
import { TeacherModule } from '../teacher/teacher.module';
import { GuardiansModule } from '../guardians/guardians.module';
import { CoursesModule } from '../courses/courses.module';
import { SectionsModule } from '../sections/sections.module';
import { DepartmentsModule } from '../departments/departments.module';
import { BuildingsModule } from '../buildings/buildings.module';
import { RoomsModule } from '../rooms/rooms.module';
import { CohortsModule } from '../cohorts/cohorts.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    PrismaModule,
    StudentModule,
    TeacherModule,
    GuardiansModule,
    CoursesModule,
    SectionsModule,
    DepartmentsModule,
    BuildingsModule,
    RoomsModule,
    CohortsModule,
    AttendanceModule,
    EnrollmentsModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
