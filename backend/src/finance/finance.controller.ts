import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateFinancialStructureDto, UpdateFinancialStructureDto, CreateManualEntryDto, MarkPaidDto, ConfirmEntryDto } from './finance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) { }

  @Post('structures')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.ORG_MANAGER)
  createStructure(@Body() dto: CreateFinancialStructureDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.createStructure(dto, req.user);
  }

  @Patch('structures/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.ORG_MANAGER)
  updateStructure(@Param('id') id: string, @Body() dto: UpdateFinancialStructureDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.updateStructure(id, dto, req.user);
  }

  @Get('structures')
  getStructures(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
    @Query('studentId') studentId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.financeService.getStructures(orgId, req.user, studentId, teacherId);
  }

  @Get('entries')
  getEntries(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
    @Query('studentId') studentId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.financeService.getEntries(orgId, req.user, studentId, teacherId);
  }

  @Get('transactions')
  getTransactions(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
    @Query('studentId') studentId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.financeService.getTransactions(orgId, req.user, studentId, teacherId);
  }

  @Get('stats')
  getStats(
    @Query('organizationId') orgId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.financeService.getStats(orgId, req.user);
  }

  @Post('entries/manual')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.ORG_MANAGER)
  createManualEntry(@Body() dto: CreateManualEntryDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.createManualEntry(dto, req.user);
  }

  @Patch('entries/:id/mark-paid')
  markEntryPaid(@Param('id') id: string, @Body() dto: MarkPaidDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.markEntryPaid(id, req.user, dto);
  }

  @Patch('entries/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ORG_ADMIN, Role.ORG_MANAGER)
  confirmEntry(@Param('id') id: string, @Body() dto: ConfirmEntryDto, @Request() req: AuthenticatedRequest) {
    return this.financeService.confirmEntry(id, req.user, dto);
  }
}
