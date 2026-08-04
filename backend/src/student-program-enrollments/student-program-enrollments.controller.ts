import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import {
  ActivateProgramCycleDto,
  AdmitStudentProgramDto,
  ProgramEnrollmentReasonDto,
  RepeatProgramCycleDto,
  ResolveProgramCycleDto,
  TransferStudentProgramDto,
  WithdrawStudentProgramDto,
} from './dto/student-program-enrollment.dto';
import { StudentProgramEnrollmentsService } from './student-program-enrollments.service';

@Controller('org/students/:studentId/program-enrollments')
export class StudentProgramEnrollmentsController {
  constructor(private readonly service: StudentProgramEnrollmentsService) {}

  @Access(AccessLevel.READ)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get()
  list(@OrgId() orgId: string, @Param('studentId') studentId: string, @Req() req: AuthenticatedRequest) {
    return this.service.list(orgId, studentId, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post('admit')
  admit(@OrgId() orgId: string, @Param('studentId') studentId: string, @Body() dto: AdmitStudentProgramDto, @Req() req: AuthenticatedRequest) {
    return this.service.admit(orgId, studentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post('transfer')
  transfer(@OrgId() orgId: string, @Param('studentId') studentId: string, @Body() dto: TransferStudentProgramDto, @Req() req: AuthenticatedRequest) {
    return this.service.transfer(orgId, studentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/hold')
  hold(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: ProgramEnrollmentReasonDto, @Req() req: AuthenticatedRequest) {
    return this.service.hold(orgId, studentId, enrollmentId, dto.reason, req.user.id);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/resume')
  resume(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Req() req: AuthenticatedRequest) {
    return this.service.resume(orgId, studentId, enrollmentId, req.user.id);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/withdraw')
  withdraw(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: WithdrawStudentProgramDto, @Req() req: AuthenticatedRequest) {
    return this.service.withdraw(orgId, studentId, enrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/cycles/activate')
  activateCycle(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: ActivateProgramCycleDto, @Req() req: AuthenticatedRequest) {
    return this.service.activateCycle(orgId, studentId, enrollmentId, dto, req.user.id);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/cycles/:cycleId/complete')
  completeCycle(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('cycleId') cycleId: string, @Body() dto: ResolveProgramCycleDto, @Req() req: AuthenticatedRequest) {
    return this.service.completeCycle(orgId, studentId, enrollmentId, cycleId, dto, req.user.id);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/cycles/:cycleId/skip')
  skipCycle(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('cycleId') cycleId: string, @Body() dto: ResolveProgramCycleDto, @Req() req: AuthenticatedRequest) {
    return this.service.skipCycle(orgId, studentId, enrollmentId, cycleId, dto, req.user.id);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/cycles/:cycleId/repeat')
  repeatCycle(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('cycleId') cycleId: string, @Body() dto: RepeatProgramCycleDto, @Req() req: AuthenticatedRequest) {
    return this.service.repeatCycle(orgId, studentId, enrollmentId, cycleId, dto, req.user.id);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/complete')
  completeProgram(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: ResolveProgramCycleDto, @Req() req: AuthenticatedRequest) {
    return this.service.completeProgram(orgId, studentId, enrollmentId, dto, req.user.id);
  }
}
