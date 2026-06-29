import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { CohortsService } from './cohorts.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/cohorts')
export class CohortsController {
  constructor(private readonly cohortsService: CohortsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateCohortDto) {
    return this.cohortsService.createCohort(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('academicCycleId') academicCycleId?: string,
    @Query('includeAllCycles') includeAllCycles?: string,
  ) {
    return this.cohortsService.getCohorts(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      sortBy,
      sortOrder,
      academicCycleId,
      includeAllCycles: includeAllCycles === 'true',
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Get(':id')
  findOne(@OrgId() orgId: string, @Param('id') id: string) {
    return this.cohortsService.getCohort(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCohortDto,
  ) {
    return this.cohortsService.updateCohort(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.cohortsService.deleteCohort(orgId, id);
  }

  // --- Student ↔ Cohort ---

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post(':id/students')
  addStudents(
    @OrgId() orgId: string,
    @Param('id') cohortId: string,
    @Body('studentIds') studentIds: string[],
  ) {
    if (!studentIds || studentIds.length === 0) {
      throw new BadRequestException('studentIds array is required');
    }
    if (studentIds.length === 1) {
      return this.cohortsService.addStudentToCohort(orgId, cohortId, studentIds[0]);
    }
    return this.cohortsService.addStudentsToCohortBulk(orgId, cohortId, studentIds);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id/students/:studentId')
  removeStudent(
    @OrgId() orgId: string,
    @Param('id') cohortId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.cohortsService.removeStudentFromCohort(orgId, cohortId, studentId);
  }

  // --- Section ↔ Cohort ---

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post(':id/sections')
  assignSection(
    @OrgId() orgId: string,
    @Param('id') cohortId: string,
    @Body('sectionId') sectionId: string,
  ) {
    if (!sectionId) throw new BadRequestException('sectionId is required');
    return this.cohortsService.assignSectionToCohort(orgId, cohortId, sectionId);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id/sections/:sectionId')
  removeSection(
    @OrgId() orgId: string,
    @Param('id') cohortId: string,
    @Param('sectionId') sectionId: string,
  ) {
    return this.cohortsService.removeSectionFromCohort(orgId, cohortId, sectionId);
  }

  // --- Exclusions ---

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Post('enrollments/exclude')
  excludeStudent(
    @OrgId() orgId: string,
    @Body('studentId') studentId: string,
    @Body('sectionId') sectionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!studentId || !sectionId) {
      throw new BadRequestException('studentId and sectionId are required');
    }
    return this.cohortsService.excludeStudentFromSection(orgId, studentId, sectionId, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Post('enrollments/include')
  includeStudent(
    @OrgId() orgId: string,
    @Body('studentId') studentId: string,
    @Body('sectionId') sectionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!studentId || !sectionId) {
      throw new BadRequestException('studentId and sectionId are required');
    }
    return this.cohortsService.includeStudentInSection(orgId, studentId, sectionId, req.user);
  }
}
