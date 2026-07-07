import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { InsightsModule } from '../insights/insights.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AIAcademicToolsService } from './ai-academic-tools.service';
import { AIBillingService } from './ai-billing.service';
import { AIController } from './ai.controller';
import { AIConversationService } from './ai-conversation.service';
import { AIAuditService } from './ai-audit.service';
import { AICreditService } from './ai-credit.service';
import { AIEntitlementService } from './ai-entitlement.service';
import { AIEntityResolverService } from './ai-entity-resolver.service';
import { AIKnowledgeService } from './ai-knowledge.service';
import {
  AILangChainProviderAdapter,
  AIProviderService,
} from './ai-provider.service';
import { AIPerformanceToolsService } from './ai-performance-tools.service';
import { AIScheduleToolsService } from './ai-schedule-tools.service';
import { AIService } from './ai.service';
import { AISettingsService } from './ai-settings.service';
import { AISubscriptionService } from './ai-subscription.service';
import { AIToolRegistryService } from './ai-tool-registry.service';
import { AIUsageService } from './ai-usage.service';

@Module({
  imports: [PrismaModule, AttendanceModule, EvaluationsModule, InsightsModule],
  controllers: [AIController],
  providers: [
    AIAcademicToolsService,
    AIBillingService,
    AIConversationService,
    AIAuditService,
    AICreditService,
    AIEntitlementService,
    AIEntityResolverService,
    AIKnowledgeService,
    AILangChainProviderAdapter,
    AIPerformanceToolsService,
    AIProviderService,
    AIScheduleToolsService,
    AIService,
    AISettingsService,
    AISubscriptionService,
    AIToolRegistryService,
    AIUsageService,
  ],
  exports: [
    AIAcademicToolsService,
    AIBillingService,
    AIConversationService,
    AIAuditService,
    AICreditService,
    AIEntitlementService,
    AIEntityResolverService,
    AIKnowledgeService,
    AIPerformanceToolsService,
    AIProviderService,
    AIScheduleToolsService,
    AIService,
    AISettingsService,
    AISubscriptionService,
    AIToolRegistryService,
    AIUsageService,
  ],
})
export class AIModule {}
