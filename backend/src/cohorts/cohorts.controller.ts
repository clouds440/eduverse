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
import { AssignCohortSectionDto, CreateCohortOfferingDto, UpdateCohortOfferingDto } from './dto/cohort-offering.dto';
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
    @Query('programId') programId?: string,
  ) {
    return this.cohortsService.getCohorts(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      sortBy,
      sortOrder,
      academicCycleId,
      programId,
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
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cohortsService.updateCohort(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  remove(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cohortsService.deleteCohort(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post(':id/offerings')
  createOffering(
    @OrgId() orgId: string,
    @Param('id') cohortId: string,
    @Body() dto: CreateCohortOfferingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cohortsService.createOffering(orgId, cohortId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('offerings/:offeringId')
  updateOffering(
    @OrgId() orgId: string,
    @Param('offeringId') offeringId: string,
    @Body() dto: UpdateCohortOfferingDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cohortsService.updateOffering(orgId, offeringId, dto, req.user);
  }

  // --- Student ↔ Cohort ---

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('offerings/:offeringId/students')
  addStudents(
    @OrgId() orgId: string,
    @Param('offeringId') offeringId: string,
    @Body('studentIds') studentIds: string[],
    @Request() req: AuthenticatedRequest,
  ) {
    if (!studentIds || studentIds.length === 0) {
      throw new BadRequestException('studentIds array is required');
    }
    if (studentIds.length === 1) {
      return this.cohortsService.addStudentToCohort(orgId, offeringId, studentIds[0], req.user);
    }
    return this.cohortsService.addStudentsToCohortBulk(orgId, offeringId, studentIds, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete('offerings/:offeringId/students/:studentId')
  removeStudent(
    @OrgId() orgId: string,
    @Param('offeringId') offeringId: string,
    @Param('studentId') studentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cohortsService.removeStudentFromCohort(orgId, offeringId, studentId, req.user);
  }

  // --- Section ↔ Cohort ---

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('offerings/:offeringId/sections')
  assignSection(
    @OrgId() orgId: string,
    @Param('offeringId') offeringId: string,
    @Body() dto: AssignCohortSectionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cohortsService.assignSectionToCohort(orgId, offeringId, dto.sectionId, req.user, dto.source, dto.isDefault);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete('offerings/:offeringId/sections/:sectionId')
  removeSection(
    @OrgId() orgId: string,
    @Param('offeringId') offeringId: string,
    @Param('sectionId') sectionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.cohortsService.removeSectionFromCohort(orgId, offeringId, sectionId, req.user);
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
