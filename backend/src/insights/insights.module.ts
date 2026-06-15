import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminInsightsBuilder } from './builders/admin-insights.builder';
import { FinanceInsightsBuilder } from './builders/finance-insights.builder';
import { GuardianInsightsBuilder } from './builders/guardian-insights.builder';
import { StudentInsightsBuilder } from './builders/student-insights.builder';
import { TeacherInsightsBuilder } from './builders/teacher-insights.builder';

@Module({
  imports: [PrismaModule],
  providers: [
    InsightsService,
    AdminInsightsBuilder,
    TeacherInsightsBuilder,
    StudentInsightsBuilder,
    GuardianInsightsBuilder,
    FinanceInsightsBuilder,
  ],
  exports: [InsightsService, FinanceInsightsBuilder],
})
export class InsightsModule {}
