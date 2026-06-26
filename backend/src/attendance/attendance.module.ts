import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentModule } from '../students/student.module';
import { TeacherModule } from '../teacher/teacher.module';
import { SectionsModule } from '../sections/sections.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, StudentModule, TeacherModule, SectionsModule, NotificationsModule],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
