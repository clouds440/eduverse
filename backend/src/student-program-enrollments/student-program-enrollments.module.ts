import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentProgramEnrollmentsController } from './student-program-enrollments.controller';
import { StudentProgramEnrollmentsService } from './student-program-enrollments.service';
import { ProgressionWorkbenchController } from './progression-workbench.controller';
import { ProgressionWorkbenchService } from './progression-workbench.service';

@Module({
  imports: [PrismaModule],
  controllers: [StudentProgramEnrollmentsController, ProgressionWorkbenchController],
  providers: [StudentProgramEnrollmentsService, ProgressionWorkbenchService],
  exports: [StudentProgramEnrollmentsService],
})
export class StudentProgramEnrollmentsModule {}
