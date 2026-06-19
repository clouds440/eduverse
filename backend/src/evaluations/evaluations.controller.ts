import { Body, Controller, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { EvaluationType } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { UpdateEvaluationDto } from './dto/update-evaluation.dto';
import { EvaluationVisibilityDto } from './dto/evaluation-visibility.dto';
import { BulkCreateEvaluationWindowsDto, CreateEvaluationWindowDto, UpdateEvaluationWindowDto } from './dto/evaluation-window.dto';
import { EvaluationsService } from './evaluations.service';

@Access(AccessLevel.READ)
@Controller('org/evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Roles(Role.STUDENT)
  @Get('pending')
  pending(@OrgId() orgId: string, @Request() req: AuthenticatedRequest) {
    return this.evaluationsService.getPending(orgId, req.user);
  }

  @Roles(Role.STUDENT)
  @Access(AccessLevel.WRITE)
  @Post()
  create(
    @OrgId() orgId: string,
    @Body() dto: CreateEvaluationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.evaluationsService.createEvaluation(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Get('windows')
  windows(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.evaluationsService.listWindows(orgId, req.user, {
      academicCycleId,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('windows/bulk')
  createWindowsBulk(
    @OrgId() orgId: string,
    @Body() dto: BulkCreateEvaluationWindowsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.evaluationsService.createWindowsBulk(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('windows')
  createWindow(
    @OrgId() orgId: string,
    @Body() dto: CreateEvaluationWindowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.evaluationsService.createWindow(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch('windows/:id')
  updateWindow(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationWindowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.evaluationsService.updateWindow(orgId, id, dto, req.user);
  }

  @Roles(Role.TEACHER, Role.ORG_MANAGER)
  @Get('teacher/me')
  teacherMe(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('courseId') courseId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('rating') rating?: string,
  ) {
    return this.evaluationsService.getTeacherSelfFeedback(orgId, req.user, {
      academicCycleId,
      courseId,
      sectionId,
      rating: rating ? parseInt(rating, 10) : undefined,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Get('teacher/:teacherId/summary')
  teacherSummary(
    @OrgId() orgId: string,
    @Param('teacherId') teacherId: string,
    @Request() req: AuthenticatedRequest,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('courseId') courseId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('rating') rating?: string,
  ) {
    return this.evaluationsService.getTeacherSummary(orgId, teacherId, req.user, {
      academicCycleId,
      courseId,
      sectionId,
      rating: rating ? parseInt(rating, 10) : undefined,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('course/:courseId/summary')
  courseSummary(
    @OrgId() orgId: string,
    @Param('courseId') courseId: string,
    @Request() req: AuthenticatedRequest,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('rating') rating?: string,
  ) {
    return this.evaluationsService.getCourseSummary(orgId, courseId, req.user, {
      academicCycleId,
      sectionId,
      rating: rating ? parseInt(rating, 10) : undefined,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: EvaluationType,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('courseId') courseId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('rating') rating?: string,
    @Query('ratingMin') ratingMin?: string,
    @Query('ratingMax') ratingMax?: string,
    @Query('hasFeedback') hasFeedback?: string,
    @Query('isHidden') isHidden?: string,
  ) {
    return this.evaluationsService.listEvaluations(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      type,
      academicCycleId,
      courseId,
      sectionId,
      teacherId,
      rating: rating ? parseInt(rating, 10) : undefined,
      ratingMin: ratingMin ? parseInt(ratingMin, 10) : undefined,
      ratingMax: ratingMax ? parseInt(ratingMax, 10) : undefined,
      hasFeedback: hasFeedback === undefined ? undefined : hasFeedback === 'true',
      isHidden: isHidden === undefined ? undefined : isHidden === 'true',
    }, req.user);
  }

  @Roles(Role.STUDENT)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEvaluationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.evaluationsService.updateEvaluation(orgId, id, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Patch(':id/visibility')
  visibility(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: EvaluationVisibilityDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.evaluationsService.setVisibility(orgId, id, dto, req.user);
  }
}
