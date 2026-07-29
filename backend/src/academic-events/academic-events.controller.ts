import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { AcademicEventType } from '@/prisma/prisma-client';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { CreateAcademicEventDto } from './dto/create-academic-event.dto';
import { UpdateAcademicEventDto } from './dto/update-academic-event.dto';
import { AcademicEventsService } from './academic-events.service';

@Access(AccessLevel.READ)
@Controller('org/academic-events')
export class AcademicEventsController {
  constructor(private readonly academicEventsService: AcademicEventsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(
    @OrgId() orgId: string,
    @Body() dto: CreateAcademicEventDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.academicEventsService.createAcademicEvent(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: AcademicEventType,
    @Query('isActive') isActive?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.academicEventsService.getAcademicEvents(orgId, {
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

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get(':id')
  findOne(@OrgId() orgId: string, @Param('id') id: string) {
    return this.academicEventsService.getAcademicEvent(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicEventDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.academicEventsService.updateAcademicEvent(orgId, id, dto, req.user);
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
    return this.academicEventsService.setAcademicEventActive(orgId, id, isActive === true || isActive === 'true', req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  delete(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.academicEventsService.deleteAcademicEvent(orgId, id, req.user);
  }
}
