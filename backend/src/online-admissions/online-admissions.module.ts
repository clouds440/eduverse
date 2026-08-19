import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';
import { FilesModule } from '../files/files.module';
import { DEFAULT_MAX_SIZE_BYTES } from '../files/file-upload-policy';
import { OnlineAdmissionsService } from './online-admissions.service';
import { PublicOnlineAdmissionsController } from './public-online-admissions.controller';
import { AdminOnlineAdmissionsController } from './admin-online-admissions.controller';
import { ParseOnlineAdmissionSubmissionPipe } from './pipes/parse-online-admission-submission.pipe';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    FilesModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: DEFAULT_MAX_SIZE_BYTES, files: 20 },
    }),
  ],
  controllers: [PublicOnlineAdmissionsController, AdminOnlineAdmissionsController],
  providers: [OnlineAdmissionsService, ParseOnlineAdmissionSubmissionPipe],
  exports: [OnlineAdmissionsService],
})
export class OnlineAdmissionsModule {}
