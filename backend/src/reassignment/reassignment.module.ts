import { Module } from '@nestjs/common';
import { ReassignmentService } from './reassignment.service';
import { ReassignmentController } from './reassignment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentProgramEnrollmentsModule } from '../student-program-enrollments/student-program-enrollments.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [PrismaModule, StudentProgramEnrollmentsModule, EnrollmentsModule],
  controllers: [ReassignmentController],
  providers: [ReassignmentService],
  exports: [ReassignmentService],
})
export class ReassignmentModule {}
