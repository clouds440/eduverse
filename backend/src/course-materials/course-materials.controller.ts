import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CourseMaterialsService } from './course-materials.service';
import { CreateCourseMaterialDto } from './dto/create-course-material.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { Role } from '../common/enums';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('course-materials')
@UseGuards(JwtAuthGuard)
@Access(AccessLevel.READ)
export class CourseMaterialsController {
  constructor(private readonly courseMaterialsService: CourseMaterialsService) {}

  /**
   * POST /course-materials
   * Create a new course material
   */
  @Post()
  @Access(AccessLevel.WRITE)
  async createMaterial(
    @Body() dto: CreateCourseMaterialDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.courseMaterialsService.createMaterial(
      dto.sectionId,
      dto,
      req.user.id,
      req.user.role,
      req.user.organizationId || '',
    );
  }

  /**
   * GET /course-materials/section/:sectionId
   * Get all materials for a section
   */
  @Get('section/:sectionId')
  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  async getSectionMaterials(
    @Param('sectionId') sectionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.courseMaterialsService.getSectionMaterials(
      sectionId,
      req.user.id,
      req.user.role,
      req.user.organizationId || '',
    );
  }

  /**
   * DELETE /course-materials/:materialId
   * Delete a course material
   */
  @Delete(':materialId')
  @Access(AccessLevel.WRITE)
  async deleteMaterial(
    @Param('materialId') materialId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.courseMaterialsService.deleteMaterial(
      materialId,
      req.user.id,
      req.user.role,
      req.user.organizationId || '',
    );
  }

  /**
   * PUT /course-materials/:materialId
   * Update a course material
   */
  @Put(':materialId')
  @Access(AccessLevel.WRITE)
  async updateMaterial(
    @Param('materialId') materialId: string,
    @Body() dto: { title?: string; description?: string; fileIds?: string[]; filesToRemove?: string[]; links?: string[]; isVideoLink?: boolean },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.courseMaterialsService.updateMaterial(
      materialId,
      dto,
      req.user.id,
      req.user.role,
      req.user.organizationId || '',
    );
  }
}
