import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { Roles } from '../auth/roles.decorator';
import { AssignBuildingDepartmentsDto } from './dto/assign-building-departments.dto';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Access(AccessLevel.READ)
@Controller('org/buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateBuildingDto) {
    return this.buildingsService.createBuilding(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('isActive') isActive?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.buildingsService.getBuildings(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      sortBy,
      sortOrder,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      departmentId,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get(':id')
  findOne(@OrgId() orgId: string, @Param('id') id: string) {
    return this.buildingsService.getBuilding(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildingsService.updateBuilding(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/active')
  setActive(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean | string,
  ) {
    return this.buildingsService.setActive(orgId, id, isActive === true || isActive === 'true');
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post(':id/departments')
  assignDepartments(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: AssignBuildingDepartmentsDto,
  ) {
    return this.buildingsService.assignDepartments(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id/departments/:departmentId')
  removeDepartment(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Param('departmentId') departmentId: string,
  ) {
    return this.buildingsService.removeDepartment(orgId, id, departmentId);
  }
}
