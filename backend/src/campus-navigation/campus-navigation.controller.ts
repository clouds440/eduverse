import { Controller, Get, Query } from '@nestjs/common';
import { RoomType } from '@/prisma/prisma-client';
import { Roles } from '../auth/roles.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { CampusNavigationService } from './campus-navigation.service';

@Access(AccessLevel.READ)
@Controller('org/campus-navigation')
export class CampusNavigationController {
  constructor(private readonly campusNavigationService: CampusNavigationService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Query('q') q?: string,
    @Query('roomId') roomId?: string,
    @Query('buildingCode') buildingCode?: string,
    @Query('departmentCode') departmentCode?: string,
    @Query('floor') floor?: string,
    @Query('roomType') roomType?: RoomType,
  ) {
    return this.campusNavigationService.getNavigation(orgId, {
      q,
      roomId,
      buildingCode,
      departmentCode,
      floor,
      roomType,
    });
  }
}
