import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { Role } from '../common/enums';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { EnrollmentsService } from './enrollments.service';
import { BulkEnrollStudentsDto, EnrollStudentDto, TransferEnrollmentDto, WithdrawEnrollmentDto } from './dto/enrollment.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get()
  list(
    @OrgId() orgId: string,
    @Query('studentId') studentId: string | undefined,
    @Query('sectionId') sectionId: string | undefined,
    @Query('academicCycleId') academicCycleId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollments.list(orgId, { studentId, sectionId, academicCycleId }, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  enroll(
    @OrgId() orgId: string,
    @Body() dto: EnrollStudentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollments.enroll(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('bulk')
  bulkEnroll(
    @OrgId() orgId: string,
    @Body() dto: BulkEnrollStudentsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollments.bulkEnroll(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('transfer')
  transfer(
    @OrgId() orgId: string,
    @Body() dto: TransferEnrollmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollments.transfer(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete()
  withdraw(
    @OrgId() orgId: string,
    @Query('studentId') studentId: string,
    @Query('sectionId') sectionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollments.withdraw(orgId, { studentId, sectionId }, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('withdraw')
  withdrawPost(
    @OrgId() orgId: string,
    @Body() dto: WithdrawEnrollmentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollments.withdraw(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete('cohorts/:cohortId/students/:studentId')
  withdrawCohort(
    @OrgId() orgId: string,
    @Param('cohortId') cohortId: string,
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.enrollments.withdrawCohort(orgId, studentId, cohortId, req.user);
  }
}
