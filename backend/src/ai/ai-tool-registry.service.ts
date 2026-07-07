import { Injectable } from '@nestjs/common';
import { AIAuditService } from './ai-audit.service';
import type { AIToolContext, AIToolDefinition, AIToolResult } from './ai.types';

@Injectable()
export class AIToolRegistryService {
  private readonly tools = new Map<string, AIToolDefinition>();

  constructor(private readonly auditService: AIAuditService) {}

  register(tool: AIToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  listTools() {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }

  async runTool<TInput, TOutput>(
    toolName: string,
    input: TInput,
    context: AIToolContext,
  ): Promise<AIToolResult<TOutput>> {
    const start = Date.now();
    const tool = this.tools.get(toolName) as AIToolDefinition<TInput, TOutput> | undefined;

    if (!tool) {
      const result: AIToolResult<TOutput> = {
        ok: false,
        code: 'NOT_FOUND',
        message: 'AI tool is not available.',
      };
      await this.auditService.logToolCall({
        userId: context.userId,
        orgId: context.orgId,
        subscriptionId: context.subscriptionId,
        sourceType: context.sourceType,
        toolName,
        allowed: false,
        latencyMs: Date.now() - start,
      });
      return result;
    }

    let result: AIToolResult<TOutput>;
    try {
      result = await tool.run(input, context);
    } catch {
      result = {
        ok: false,
        code: 'UNAVAILABLE',
        message: 'AI tool failed unexpectedly.',
      };
    }

    await this.auditService.logToolCall({
      userId: context.userId,
      orgId: context.orgId,
      subscriptionId: context.subscriptionId,
      sourceType: context.sourceType,
      toolName,
      allowed: result.ok,
      latencyMs: Date.now() - start,
      creditEstimate: estimateCredits(result),
      providerTokenEstimate: estimateProviderTokens(result),
    });

    return result;
  }

  async runTools(
    requests: Array<{ name: string; input?: Record<string, unknown> }>,
    context: AIToolContext,
  ) {
    const uniqueRequests = requests.filter((request, index, allRequests) => (
      allRequests.findIndex((candidate) => (
        candidate.name === request.name
        && JSON.stringify(candidate.input ?? {}) === JSON.stringify(request.input ?? {})
      )) === index
    ));

    return Promise.all(uniqueRequests.map(async (request) => ({
      tool: request.name,
      input: request.input ?? {},
      result: await this.runTool(request.name, request.input ?? {}, context),
    })));
  }
}

function estimateProviderTokens(value: unknown) {
  const text = JSON.stringify(value ?? '');
  return Math.ceil(text.length / 4);
}

function estimateCredits(value: unknown) {
  return Math.max(1, Math.ceil(estimateProviderTokens(value) / 1000));
}
