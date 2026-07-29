import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { FilesModule } from '../files/files.module';
import { AcademicEventsController } from './academic-events.controller';
import { AcademicEventsService } from './academic-events.service';

@Module({
  imports: [PrismaModule, AnnouncementsModule, FilesModule],
  controllers: [AcademicEventsController],
  providers: [AcademicEventsService],
  exports: [AcademicEventsService],
})
export class AcademicEventsModule {}
