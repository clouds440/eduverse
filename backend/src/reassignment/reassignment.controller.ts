import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReassignmentService } from './reassignment.service';
import { ReassignStudentsDto } from './dto/reassign-students.dto';
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
@Controller('org/reassignment')
export class ReassignmentController {
  constructor(private readonly reassignmentService: ReassignmentService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  reassign(@OrgId() orgId: string, @Body() dto: ReassignStudentsDto, @Request() req: AuthenticatedRequest) {
    return this.reassignmentService.reassignStudents(orgId, dto, req.user);
  }
}
