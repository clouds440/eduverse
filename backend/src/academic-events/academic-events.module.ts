import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { AcademicEventsController } from './academic-events.controller';
import { AcademicEventsService } from './academic-events.service';

@Module({
  imports: [PrismaModule, AnnouncementsModule],
  controllers: [AcademicEventsController],
  providers: [AcademicEventsService],
  exports: [AcademicEventsService],
})
export class AcademicEventsModule {}
