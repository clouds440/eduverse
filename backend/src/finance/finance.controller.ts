import { BadRequestException, Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateFinancialStructureDto, UpdateFinancialStructureDto, CreateManualEntryDto, MarkPaidDto, ConfirmEntryDto } from './finance.dto';
import { InsightsService } from '../insights/insights.service';
import { FinanceInsightsQueryDto } from '../insights/dto/insights-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BillingCycle, EntryStatus, FinanceAssignmentSource, FinanceCategory, FinanceTargetType, TransactionType } from '@prisma/client';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly insightsService: InsightsService,
  ) { }

  @Post('structures')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  @Access(AccessLevel.WRITE)
  createStructure(@Body() dto: CreateFinancialStructureDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.createStructure(dto, req.user);
  }

  @Patch('structures/:id')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  @Access(AccessLevel.WRITE)
  updateStructure(@Param('id') id: string, @Body() dto: UpdateFinancialStructureDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.updateStructure(id, dto, req.user);
  }

  @Get('structures')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  getStructures(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
    @Query('studentId') studentId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('targetType') targetType?: string,
    @Query('category') category?: string,
    @Query('billingCycle') billingCycle?: string,
    @Query('assignmentSource') assignmentSource?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.financeService.getStructures(orgId, req.user, {
      studentId,
      teacherId,
      targetType: targetType as FinanceTargetType | undefined,
      category: category as FinanceCategory | undefined,
      billingCycle: billingCycle as BillingCycle | undefined,
      assignmentSource: assignmentSource as FinanceAssignmentSource | undefined,
      isActive,
      search,
    });
  }

  @Get('entries')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  getEntries(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
    @Query('studentId') studentId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('targetType') targetType?: string,
    @Query('category') category?: string,
    @Query('billingCycle') billingCycle?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('dueFrom') dueFrom?: string,
    @Query('dueTo') dueTo?: string,
  ) {
    return this.financeService.getEntries(orgId, req.user, {
      studentId,
      teacherId,
      targetType: targetType as FinanceTargetType | undefined,
      category: category as FinanceCategory | undefined,
      billingCycle: billingCycle as BillingCycle | undefined,
      status: status as EntryStatus | undefined,
      search,
      dueFrom,
      dueTo,
    });
  }

  @Get('transactions')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  getTransactions(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
    @Query('studentId') studentId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('targetType') targetType?: string,
    @Query('category') category?: string,
    @Query('billingCycle') billingCycle?: string,
    @Query('type') type?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.financeService.getTransactions(orgId, req.user, {
      studentId,
      teacherId,
      targetType: targetType as FinanceTargetType | undefined,
      category: category as FinanceCategory | undefined,
      billingCycle: billingCycle as BillingCycle | undefined,
      type: type as TransactionType | undefined,
      paymentMethod,
      search,
      dateFrom,
      dateTo,
    });
  }

  @Get('teacher-overview')
  @Roles(Role.TEACHER)
  getTeacherOverview(@Request() req: AuthenticatedRequest) {
    return this.financeService.getTeacherOverview(req.user);
  }
  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  getStats(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.getStats(orgId, req.user);
  }

  @Get('insights')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER)
  getInsights(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
    @Query() query: FinanceInsightsQueryDto,
  ) {
    const finalOrgId = orgId || req.user.organizationId;
    if (!finalOrgId) {
      throw new BadRequestException('Organization is required');
    }
    return this.insightsService.getFinanceInsights(finalOrgId, req.user, query);
  }

  @Post('entries/manual')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  @Access(AccessLevel.WRITE)
  createManualEntry(@Body() dto: CreateManualEntryDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.createManualEntry(dto, req.user);
  }

  @Patch('entries/:id/mark-paid')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.FINANCE_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  @Access(AccessLevel.WRITE)
  markEntryPaid(@Param('id') id: string, @Body() dto: MarkPaidDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.markEntryPaid(id, req.user, dto);
  }

  @Patch('entries/:id/confirm')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  @Access(AccessLevel.WRITE)
  confirmEntry(@Param('id') id: string, @Body() dto: ConfirmEntryDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.confirmEntry(id, req.user, dto);
  }

  @Patch('claims/:id/reject')
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.FINANCE_MANAGER)
  @Access(AccessLevel.WRITE)
  rejectPaymentClaim(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.rejectPaymentClaim(id, req.user, rejectionReason);
  }
}
