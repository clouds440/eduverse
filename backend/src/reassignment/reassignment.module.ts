import { Module } from '@nestjs/common';
import { ReassignmentService } from './reassignment.service';
import { ReassignmentController } from './reassignment.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReassignmentController],
  providers: [ReassignmentService],
  exports: [ReassignmentService],
})
export class ReassignmentModule {}
