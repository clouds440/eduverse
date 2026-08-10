import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import {
  ActivateProgramStageDto,
  AdvanceProgramStageDto,
  AdmitStudentProgramDto,
  ProgramEnrollmentReasonDto,
  RepeatProgramStageDto,
  ResolveProgramStageDto,
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

  @Access(AccessLevel.READ)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get(':enrollmentId/progression-preview')
  progressionPreview(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Req() req: AuthenticatedRequest) {
    return this.service.progressionPreview(orgId, studentId, enrollmentId, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/hold')
  hold(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: ProgramEnrollmentReasonDto, @Req() req: AuthenticatedRequest) {
    return this.service.hold(orgId, studentId, enrollmentId, dto.reason, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/resume')
  resume(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Req() req: AuthenticatedRequest) {
    return this.service.resume(orgId, studentId, enrollmentId, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/withdraw')
  withdraw(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: WithdrawStudentProgramDto, @Req() req: AuthenticatedRequest) {
    return this.service.withdraw(orgId, studentId, enrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/stages/activate')
  activateStage(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: ActivateProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.service.activateStage(orgId, studentId, enrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/stages/:stageEnrollmentId/complete')
  completeStage(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('stageEnrollmentId') stageEnrollmentId: string, @Body() dto: ResolveProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.service.completeStage(orgId, studentId, enrollmentId, stageEnrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/stages/:stageEnrollmentId/advance')
  advanceStage(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('stageEnrollmentId') stageEnrollmentId: string, @Body() dto: AdvanceProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.service.advanceStage(orgId, studentId, enrollmentId, stageEnrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/stages/:stageEnrollmentId/complete-program')
  completeStageAndProgram(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('stageEnrollmentId') stageEnrollmentId: string, @Body() dto: ResolveProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.service.completeStageAndProgram(orgId, studentId, enrollmentId, stageEnrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/stages/:stageEnrollmentId/skip')
  skipStage(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('stageEnrollmentId') stageEnrollmentId: string, @Body() dto: ResolveProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.service.skipStage(orgId, studentId, enrollmentId, stageEnrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/stages/:stageEnrollmentId/repeat')
  repeatStage(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Param('stageEnrollmentId') stageEnrollmentId: string, @Body() dto: RepeatProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.service.repeatStage(orgId, studentId, enrollmentId, stageEnrollmentId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':enrollmentId/complete')
  completeProgram(@OrgId() orgId: string, @Param('studentId') studentId: string, @Param('enrollmentId') enrollmentId: string, @Body() dto: ResolveProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.service.completeProgram(orgId, studentId, enrollmentId, dto, req.user);
  }
}
