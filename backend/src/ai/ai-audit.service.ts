import { Injectable, Logger } from '@nestjs/common';
import { AIUsageSourceType } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

interface AIToolCallAuditInput {
  userId?: string | null;
  orgId?: string | null;
  subscriptionId?: string | null;
  sourceType?: AIUsageSourceType | null;
  toolName: string;
  allowed: boolean;
  latencyMs: number;
  creditEstimate?: number | null;
  providerTokenEstimate?: number | null;
}

@Injectable()
export class AIAuditService {
  private readonly logger = new Logger(AIAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logToolCall(input: AIToolCallAuditInput) {
    try {
      await this.prisma.aIToolCallLog.create({
        data: {
          userId: input.userId ?? null,
          orgId: input.orgId ?? null,
          subscriptionId: input.subscriptionId ?? null,
          sourceType: input.sourceType ?? null,
          toolName: input.toolName,
          allowed: input.allowed,
          latencyMs: Math.max(0, Math.round(input.latencyMs)),
          creditEstimate: input.creditEstimate ?? null,
          providerTokenEstimate: input.providerTokenEstimate ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write AI tool audit log for ${input.toolName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
