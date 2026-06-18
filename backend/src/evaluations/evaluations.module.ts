import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationAggregationService } from './evaluation-aggregation.service';
import { EvaluationEligibilityService } from './evaluation-eligibility.service';
import { EvaluationsService } from './evaluations.service';

@Module({
  imports: [PrismaModule],
  controllers: [EvaluationsController],
  providers: [EvaluationAggregationService, EvaluationEligibilityService, EvaluationsService],
  exports: [EvaluationAggregationService, EvaluationEligibilityService, EvaluationsService],
})
export class EvaluationsModule {}
