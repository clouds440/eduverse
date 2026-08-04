import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentModule } from '../students/student.module';
import { SectionsModule } from '../sections/sections.module';
import { GpaModule } from '../gpa/gpa.module';
import { FilesModule } from '../files/files.module';
import { GradeEvidenceModule } from '../grade-evidence/grade-evidence.module';

@Module({
  imports: [PrismaModule, NotificationsModule, StudentModule, SectionsModule, GpaModule, FilesModule, GradeEvidenceModule],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
