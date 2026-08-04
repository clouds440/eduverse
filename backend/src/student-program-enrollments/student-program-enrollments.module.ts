import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentProgramEnrollmentsController } from './student-program-enrollments.controller';
import { StudentProgramEnrollmentsService } from './student-program-enrollments.service';

@Module({
  imports: [PrismaModule],
  controllers: [StudentProgramEnrollmentsController],
  providers: [StudentProgramEnrollmentsService],
  exports: [StudentProgramEnrollmentsService],
})
export class StudentProgramEnrollmentsModule {}
