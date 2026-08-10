import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { CurriculumStatus, ProgramStatus } from '@/prisma/prisma-client';
import { ProgramsService } from './programs.service';
import {
  CreateProgramDto,
  ReplaceProgramStructureDto,
  TransitionProgramDto,
  UpdateProgramDto,
} from './dto/program.dto';
import {
  CreateCourseRequirementDto,
  CreateCurriculumDto,
  CreateProgramStageDto,
  TransitionCurriculumDto,
  UpdateCourseRequirementDto,
  UpdateCurriculumDto,
  UpdateProgramStageDto,
} from './dto/curriculum.dto';

@Access(AccessLevel.READ)
@Controller('org/programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateProgramDto, @Req() req: AuthenticatedRequest) {
    return this.programs.create(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get()
  list(
    @OrgId() orgId: string,
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: ProgramStatus,
  ) {
    return this.programs.list(orgId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      sortBy,
      sortOrder,
      departmentId,
      status,
    }, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('eligible-cycles')
  eligibleCycles(
    @OrgId() orgId: string,
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('programId') programId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.programs.eligibleCycles(orgId, {
      search,
      programId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
    }, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Get('delivery-options')
  deliveryOptions(
    @OrgId() orgId: string,
    @Req() req: AuthenticatedRequest,
    @Query('academicCycleId') academicCycleId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.programs.deliveryOptions(orgId, academicCycleId, departmentId, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get(':id')
  get(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.programs.get(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateProgramDto, @Req() req: AuthenticatedRequest) {
    return this.programs.update(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Put(':id/structure')
  replaceStructure(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: ReplaceProgramStructureDto, @Req() req: AuthenticatedRequest) {
    return this.programs.replaceStructure(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/status')
  transitionProgram(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: TransitionProgramDto, @Req() req: AuthenticatedRequest) {
    return this.programs.transitionProgram(orgId, id, dto.status, dto.reason, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get(':id/configuration-revisions')
  revisions(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.programs.revisions(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  deleteProgram(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.programs.delete(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post(':id/curricula')
  createCurriculum(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: CreateCurriculumDto, @Req() req: AuthenticatedRequest) {
    return this.programs.createCurriculum(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('curricula/:id')
  updateCurriculum(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateCurriculumDto, @Req() req: AuthenticatedRequest) {
    return this.programs.updateCurriculum(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('curricula/:id/status')
  transitionCurriculum(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: TransitionCurriculumDto, @Req() req: AuthenticatedRequest) {
    return this.programs.transitionCurriculum(orgId, id, dto.status, dto.defaultForAdmissions, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('curricula/:id/stages')
  createStage(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: CreateProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.programs.createStage(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('stages/:id')
  updateStage(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateProgramStageDto, @Req() req: AuthenticatedRequest) {
    return this.programs.updateStage(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete('stages/:id')
  deleteStage(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.programs.deleteStage(orgId, id, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('stages/:id/requirements')
  createRequirement(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: CreateCourseRequirementDto, @Req() req: AuthenticatedRequest) {
    return this.programs.createRequirement(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('requirements/:id')
  updateRequirement(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateCourseRequirementDto, @Req() req: AuthenticatedRequest) {
    return this.programs.updateRequirement(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete('requirements/:id')
  deleteRequirement(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.programs.deleteRequirement(orgId, id, req.user);
  }
}
