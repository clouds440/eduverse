import { Module } from '@nestjs/common';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PreferenceWindowsController } from './preference-windows.controller';
import { PreferenceWindowsService } from './preference-windows.service';

@Module({
  imports: [PrismaModule, AnnouncementsModule],
  controllers: [PreferenceWindowsController],
  providers: [PreferenceWindowsService],
  exports: [PreferenceWindowsService],
})
export class PreferenceWindowsModule {}
