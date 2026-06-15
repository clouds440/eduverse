import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceCron } from './finance.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InsightsModule } from '../insights/insights.module';

@Module({
  imports: [PrismaModule, NotificationsModule, InsightsModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceCron]
})
export class FinanceModule {}
