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
} from '@nestjs/common';
import { AcademicCyclesService } from './academic-cycles.service';
import { CreateAcademicCycleDto } from './dto/create-academic-cycle.dto';
import { UpdateAcademicCycleDto } from './dto/update-academic-cycle.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/academic-cycles')
export class AcademicCyclesController {
  constructor(private readonly academicCyclesService: AcademicCyclesService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateAcademicCycleDto) {
    return this.academicCyclesService.createCycle(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.academicCyclesService.getCycles(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      sortBy,
      sortOrder,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get('active')
  findActive(@OrgId() orgId: string) {
    return this.academicCyclesService.getActiveCycle(orgId);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT)
  @Get(':id')
  findOne(@OrgId() orgId: string, @Param('id') id: string) {
    return this.academicCyclesService.getCycle(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicCycleDto,
  ) {
    return this.academicCyclesService.updateCycle(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/activate')
  activate(@OrgId() orgId: string, @Param('id') id: string) {
    return this.academicCyclesService.setActiveCycle(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.academicCyclesService.deleteCycle(orgId, id);
  }
}
