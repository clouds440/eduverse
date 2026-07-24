import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TranscriptsService } from './transcripts.service';
import { StudentService } from '../students/student.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/transcripts')
export class TranscriptsController {
  constructor(
    private readonly transcriptsService: TranscriptsService,
    private readonly studentService: StudentService,
  ) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  @Get('students/:id')
  async getStudentTranscript(
    @OrgId() orgId: string,
    @Param('id') studentId: string,
    @Request() req: AuthenticatedRequest,
    @Query('cycleId') cycleId?: string,
  ) {
    // Students can only view their own transcript
    if (req.user.role === Role.STUDENT) {
      const student = await this.studentService.getStudentByUserId(req.user.id);
      if (!student || student.id !== studentId) {
        throw new ForbiddenException('Students can only view their own transcript');
      }
    }
    return this.transcriptsService.getStudentTranscript(orgId, studentId, cycleId, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Get('cycles/:id/report')
  getCycleReport(@OrgId() orgId: string, @Param('id') cycleId: string) {
    return this.transcriptsService.getCycleReport(orgId, cycleId);
  }
}
