import { Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Patch, Post, Query, Request, Res } from '@nestjs/common';
import { AISubscriptionOwnerType, Role } from '@/prisma/prisma-client';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AIBillingService } from './ai-billing.service';
import { AIEntitlementService } from './ai-entitlement.service';
import { AIKnowledgeService } from './ai-knowledge.service';
import { AIService } from './ai.service';
import { AISettingsService } from './ai-settings.service';
import { AIChatRequestDto, UpdateAIConversationDto } from './dto/ai-chat.dto';
import {
  CreateAIBillingCheckoutDto,
  CreateAIBillingPortalDto,
  UpdateAIOrgAccessPolicyDto,
  UpdateAIRoleCreditPolicyDto,
  UpdateAISubscriptionDto,
} from './dto/ai-subscription.dto';

const COPILOT_USER_ROLES = [
  Role.ORG_ADMIN,
  Role.SUB_ADMIN,
  Role.ORG_MANAGER,
  Role.FINANCE_MANAGER,
  Role.TEACHER,
  Role.STUDENT,
  Role.GUARDIAN,
];

@Controller('ai')
@Access(AccessLevel.READ)
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly billingService: AIBillingService,
    private readonly entitlementService: AIEntitlementService,
    private readonly knowledgeService: AIKnowledgeService,
    private readonly settingsService: AISettingsService,
  ) {}

  @Get('entitlement')
  @Roles(...COPILOT_USER_ROLES)
  async getEntitlement(@Request() req: AuthenticatedRequest) {
    return this.entitlementService.resolveEntitlement({
      id: req.user.id,
      organizationId: req.user.organizationId,
      role: req.user.role,
      status: req.user.status,
    });
  }

  @Post('copilot/chat')
  @Roles(...COPILOT_USER_ROLES)
  @Access(AccessLevel.WRITE)
  chat(@Request() req: AuthenticatedRequest, @Body() dto: AIChatRequestDto) {
    return this.aiService.chat(req.user, dto);
  }

  @Post('copilot/chat/stream')
  @Roles(...COPILOT_USER_ROLES)
  @Access(AccessLevel.WRITE)
  async streamChat(
    @Request() req: AuthenticatedRequest,
    @Body() dto: AIChatRequestDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const event of this.aiService.streamChat(req.user, dto)) {
        writeSseEvent(res, event.type, event);
      }
    } catch (error) {
      const errorBody = normalizeStreamError(error);
      writeSseEvent(res, 'error', errorBody);
    } finally {
      res.end();
    }
  }

  @Get('copilot/suggestions')
  @Roles(...COPILOT_USER_ROLES)
  getSuggestedQuestions(@Request() req: AuthenticatedRequest) {
    return this.aiService.generateSuggestedQuestions(req.user);
  }

  @Get('copilot/conversations')
  @Roles(...COPILOT_USER_ROLES)
  getConversations(@Request() req: AuthenticatedRequest) {
    return this.aiService.listConversations(req.user);
  }

  @Get('copilot/conversations/:id')
  @Roles(...COPILOT_USER_ROLES)
  getConversation(
    @Request() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ) {
    return this.aiService.getConversation(req.user, conversationId);
  }

  @Patch('copilot/conversations/:id')
  @Roles(...COPILOT_USER_ROLES)
  @Access(AccessLevel.WRITE)
  updateConversationTitle(
    @Request() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Body() dto: UpdateAIConversationDto,
  ) {
    return this.aiService.updateConversationTitle(req.user, conversationId, dto.title);
  }

  @Delete('copilot/conversations/:id')
  @Roles(...COPILOT_USER_ROLES)
  @Access(AccessLevel.WRITE)
  deleteConversation(
    @Request() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ) {
    return this.aiService.deleteConversation(req.user, conversationId);
  }

  @Get('docs/search')
  @Roles(...COPILOT_USER_ROLES)
  searchDocs(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      results: this.knowledgeService.searchDocs(query ?? '', Number(limit)),
    };
  }

  @Get('routes/search')
  @Roles(...COPILOT_USER_ROLES)
  searchRoutes(
    @Request() req: AuthenticatedRequest,
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ) {
    return {
      results: this.knowledgeService.searchRoutes(
        query ?? '',
        req.user.role,
        req.user.id,
        Number(limit),
      ),
    };
  }

  @Get('org/settings')
  @Roles(Role.ORG_ADMIN)
  getOrgSettings(@OrgId() organizationId: string) {
    return this.settingsService.getOrgSettings(organizationId);
  }

  @Patch('org/subscription')
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  updateOrgSubscription(
    @OrgId() organizationId: string,
    @Body() dto: UpdateAISubscriptionDto,
  ) {
    return this.settingsService.updateOrgSubscription(organizationId, dto.plan);
  }

  @Post('org/billing/checkout')
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  createOrgCheckout(
    @Request() req: AuthenticatedRequest,
    @OrgId() organizationId: string,
    @Body() dto: CreateAIBillingCheckoutDto,
  ) {
    return this.billingService.createOrgCheckoutSession(organizationId, req.user, dto.plan);
  }

  @Patch('org/access-policy')
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  updateOrgAccessPolicy(
    @OrgId() organizationId: string,
    @Body() dto: UpdateAIOrgAccessPolicyDto,
  ) {
    return this.settingsService.updateOrgAccessPolicy(organizationId, dto);
  }

  @Patch('org/role-credit-policy')
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  updateRoleCreditPolicy(
    @OrgId() organizationId: string,
    @Body() dto: UpdateAIRoleCreditPolicyDto,
  ) {
    return this.settingsService.updateRoleCreditPolicy(
      organizationId,
      dto.role,
      dto.monthlyCredits,
    );
  }

  @Get('org/usage')
  @Roles(Role.ORG_ADMIN)
  getOrgUsage(@OrgId() organizationId: string) {
    return this.settingsService.getOrgUsage(organizationId);
  }

  @Get('personal/subscription')
  @Roles(...COPILOT_USER_ROLES)
  getPersonalSubscription(@Request() req: AuthenticatedRequest) {
    return this.settingsService.getPersonalSettings(req.user.id, req.user.organizationId);
  }

  @Patch('personal/subscription')
  @Roles(...COPILOT_USER_ROLES)
  @Access(AccessLevel.WRITE)
  updatePersonalSubscription(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateAISubscriptionDto,
  ) {
    return this.settingsService.updatePersonalSubscription(
      req.user.id,
      req.user.organizationId,
      dto.plan,
    );
  }

  @Post('personal/billing/checkout')
  @Roles(...COPILOT_USER_ROLES)
  @Access(AccessLevel.WRITE)
  createPersonalCheckout(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateAIBillingCheckoutDto,
  ) {
    return this.billingService.createPersonalCheckoutSession(req.user, dto.plan);
  }

  @Post('billing/portal')
  @Roles(...COPILOT_USER_ROLES)
  @Access(AccessLevel.WRITE)
  createBillingPortal(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateAIBillingPortalDto,
  ) {
    if (dto.ownerType === AISubscriptionOwnerType.ORGANIZATION && req.user.role !== Role.ORG_ADMIN) {
      throw new ForbiddenException('Only org admins can manage organization AI billing.');
    }
    return this.billingService.createPortalSession(req.user, dto.ownerType, dto.returnPath);
  }

  @Post('billing/webhook')
  @Public()
  handleBillingWebhook(
    @Request() req: AuthenticatedRequest & { rawBody?: Buffer },
    @Headers('x-signature') signature?: string,
  ) {
    return this.billingService.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
  }

  @Get('personal/usage')
  @Roles(...COPILOT_USER_ROLES)
  getPersonalUsage(@Request() req: AuthenticatedRequest) {
    return this.settingsService.getPersonalUsage(req.user.id, req.user.organizationId);
  }
}

function writeSseEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function normalizeStreamError(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: unknown }).response;
    if (typeof response === 'object' && response && 'message' in response) {
      return response;
    }
  }

  if (error instanceof Error) {
    return {
      type: 'error',
      code: 'UNAVAILABLE',
      message: error.message,
    };
  }

  return {
    type: 'error',
    code: 'UNAVAILABLE',
    message: 'EduVerse Copilot could not respond right now.',
  };
}
