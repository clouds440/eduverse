import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { HolidayType } from '@/prisma/prisma-client';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { HolidaysService } from './holidays.service';

@Access(AccessLevel.READ)
@Controller('org/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(
    @OrgId() orgId: string,
    @Body() dto: CreateHolidayDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.holidaysService.createHoliday(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: HolidayType,
    @Query('isActive') isActive?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.holidaysService.getHolidays(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      search,
      type,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      startDate,
      endDate,
      departmentId,
    }, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
  @Get(':id')
  findOne(@OrgId() orgId: string, @Param('id') id: string) {
    return this.holidaysService.getHoliday(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHolidayDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.holidaysService.updateHoliday(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/active')
  setActive(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean | string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.holidaysService.setHolidayActive(orgId, id, isActive === true || isActive === 'true', req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  delete(@OrgId() orgId: string, @Param('id') id: string) {
    return this.holidaysService.deleteHoliday(orgId, id);
  }
}
