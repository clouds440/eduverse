import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AcademicCycleArchivesService } from './academic-cycle-archives.service';

@Controller('org/academic-cycles/:cycleId/archive')
export class AcademicCycleArchivesController {
  constructor(private readonly archives: AcademicCycleArchivesService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.READ)
  @Get()
  status(@OrgId() orgId: string, @Param('cycleId') cycleId: string) {
    return this.archives.getStatus(orgId, cycleId);
  }

  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  archive(
    @OrgId() orgId: string,
    @Param('cycleId') cycleId: string,
    @Query('retry') retry: string | undefined,
    @Req() req: { user: { id: string } },
  ) {
    return this.archives.archive(orgId, cycleId, req.user.id, retry === 'true');
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.READ)
  @Get('verify')
  verify(@OrgId() orgId: string, @Param('cycleId') cycleId: string) {
    return this.archives.verifyCurrent(orgId, cycleId);
  }
}
