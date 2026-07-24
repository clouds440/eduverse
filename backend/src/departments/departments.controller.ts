import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

@Access(AccessLevel.READ)
@Controller('org/departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.createDepartment(orgId, dto);
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
  ) {
    return this.departmentsService.getDepartments(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      sortBy,
      sortOrder,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get(':id')
  findOne(@OrgId() orgId: string, @Param('id') id: string) {
    return this.departmentsService.getDepartment(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: any,
  ) {
    return this.departmentsService.updateDepartment(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/active')
  setActive(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean | string,
  ) {
    return this.departmentsService.setActive(orgId, id, isActive === true || isActive === 'true');
  }
}
