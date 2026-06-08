import { Module } from '@nestjs/common';
import { TranscriptsService } from './transcripts.service';
import { TranscriptsController } from './transcripts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentModule } from '../students/student.module';
import { GpaModule } from '../gpa/gpa.module';

@Module({
  imports: [PrismaModule, StudentModule, GpaModule],
  controllers: [TranscriptsController],
  providers: [TranscriptsService],
  exports: [TranscriptsService],
})
export class TranscriptsModule {}
