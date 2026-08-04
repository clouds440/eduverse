import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PastRecordsController } from './past-records.controller';
import { PastRecordsService } from './past-records.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [PastRecordsController],
  providers: [PastRecordsService],
  exports: [PastRecordsService],
})
export class PastRecordsModule {}
