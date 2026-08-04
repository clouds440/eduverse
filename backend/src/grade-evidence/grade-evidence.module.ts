import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GradeEvidenceController } from './grade-evidence.controller';
import { GradeEvidenceService } from './grade-evidence.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [GradeEvidenceController],
  providers: [GradeEvidenceService],
  exports: [GradeEvidenceService],
})
export class GradeEvidenceModule {}
