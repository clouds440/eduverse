import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { Role, TeacherStatus } from '../common/enums';
import { TeacherService } from './teacher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreateTeacherDto } from '../org/dto/create-teacher.dto';
import { UpdateTeacherDto } from '../org/dto/update-teacher.dto';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) { }

  // --- Teachers ---
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get('teachers')
  async getTeachers(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('status') status?: string,
    @Query('deleted') deleted?: string,
    @Query('departmentId') departmentId?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.teacherService.getTeachers(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy,
      sortOrder,
      status,
      deleted: deleted === 'true',
      departmentId,
    }, req?.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get('managers')
  async getManagers(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('status') status?: string,
    @Query('deleted') deleted?: string,
    @Query('departmentId') departmentId?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.teacherService.getManagers(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy: sortBy || 'user.name',
      sortOrder,
      status,
      deleted: deleted === 'true',
      departmentId,
    }, req?.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.TEACHER)
  @Get('teachers/:id')
  getTeacher(
    @OrgId() orgId: string, 
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.teacherService.getTeacher(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('teachers')
  createTeacher(
    @OrgId() orgId: string,
    @Body() createTeacherDto: CreateTeacherDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.teacherService.createTeacher(orgId, createTeacherDto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('teachers/:id')
  updateTeacher(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.teacherService.updateTeacher(orgId, id, updateTeacherDto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('teachers/:id/restore')
  restoreTeacher(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('status') status?: string,
  ) {
    return this.teacherService.restoreTeacher(orgId, id, status as TeacherStatus);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete('teachers/:id')
  deleteTeacher(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.teacherService.deleteTeacher(orgId, id, req.user);
  }
}
