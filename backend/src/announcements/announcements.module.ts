import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AuthModule } from '../auth/auth.module';
import { StudentModule } from '../students/student.module';
import { TeacherModule } from '../teacher/teacher.module';

@Module({
  imports: [AuthModule, StudentModule, TeacherModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
