import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CampusNavigationController } from './campus-navigation.controller';
import { CampusNavigationService } from './campus-navigation.service';

@Module({
  imports: [PrismaModule],
  controllers: [CampusNavigationController],
  providers: [CampusNavigationService],
})
export class CampusNavigationModule {}
