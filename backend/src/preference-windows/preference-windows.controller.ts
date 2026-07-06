import { Body, Controller, Get, Param, Patch, Post, Put, Query, Request } from '@nestjs/common';
import { PreferenceWindowKind, PreferenceWindowStatus } from '@/prisma/prisma-client';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { AnnouncementPriority } from '../announcements/dto/create-announcement.dto';
import { PreferenceSubmissionDto, PreferenceWindowDto, UpdatePreferenceWindowDto } from './dto/preference-window.dto';
import { PreferenceWindowsService } from './preference-windows.service';

@Access(AccessLevel.READ)
@Controller('org/preference-windows')
export class PreferenceWindowsController {
  constructor(private readonly preferenceWindows: PreferenceWindowsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Get()
  list(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PreferenceWindowStatus,
    @Query('kind') kind?: PreferenceWindowKind,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('courseId') courseId?: string,
    @Query('cohortId') cohortId?: string,
  ) {
    return this.preferenceWindows.list(orgId, req.user, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      status,
      kind,
      academicCycleId,
      courseId,
      cohortId,
    });
  }

  @Roles(Role.STUDENT)
  @Get('my')
  my(@OrgId() orgId: string, @Request() req: AuthenticatedRequest) {
    return this.preferenceWindows.getMy(orgId, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post()
  create(
    @OrgId() orgId: string,
    @Body() dto: PreferenceWindowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.create(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Get(':id')
  get(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.get(orgId, id, req.user);
  }

  @Roles(Role.STUDENT)
  @Get(':id/student')
  getStudentWindow(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.getStudentWindow(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePreferenceWindowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.update(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post(':id/activate')
  activate(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('priority') priority: AnnouncementPriority | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.activate(orgId, id, req.user, priority);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post(':id/close')
  close(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.close(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Get(':id/results')
  results(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.results(orgId, id, req.user);
  }

  @Roles(Role.STUDENT)
  @Access(AccessLevel.WRITE)
  @Put(':id/submission')
  submit(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: PreferenceSubmissionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.preferenceWindows.submit(orgId, id, dto, req.user);
  }
}
