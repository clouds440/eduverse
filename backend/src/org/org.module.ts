import { Module } from '@nestjs/common';
import { OrgController } from './org.controller';
import { OrgService } from './org.service';
import { RemindersService } from './reminders.service';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentModule } from '../students/student.module';
import { TeacherModule } from '../teacher/teacher.module';
import { InsightsModule } from '../insights/insights.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { CoursesModule } from '../courses/courses.module';
import { SectionsModule } from '../sections/sections.module';
import { UserModule } from '../users/user.module';
import { AuthModule } from '../auth/auth.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    FilesModule,
    NotificationsModule,
    StudentModule,
    TeacherModule,
    InsightsModule,
    AssessmentsModule,
    AttendanceModule,
    CoursesModule,
    SectionsModule,
    UserModule,
    AuthModule,
    SecurityModule,
  ],
  controllers: [OrgController],
  providers: [OrgService, RemindersService],
  exports: [
    OrgService,
    StudentModule,
    TeacherModule,
    InsightsModule,
    AssessmentsModule,
    AttendanceModule,
    CoursesModule,
    SectionsModule,
  ],
})
export class OrgModule {}
