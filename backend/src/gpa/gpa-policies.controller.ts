import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { Roles } from '../auth/roles.decorator';
import { CreateGpaPolicyDto, PreviewGpaPolicyDto, UpdateGpaPolicyDto } from './dto/gpa-policy.dto';
import { GpaPoliciesService } from './gpa-policies.service';

@Controller('org/gpa-policies')
@Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
@Access(AccessLevel.READ)
export class GpaPoliciesController {
  constructor(private readonly gpaPoliciesService: GpaPoliciesService) {}

  @Get()
  list(@OrgId() orgId: string, @Query('includeArchived') includeArchived?: string) {
    return this.gpaPoliciesService.list(orgId, includeArchived === 'true');
  }

  @Post()
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  create(@OrgId() orgId: string, @Body() dto: CreateGpaPolicyDto) {
    return this.gpaPoliciesService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGpaPolicyDto,
  ) {
    return this.gpaPoliciesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  delete(@OrgId() orgId: string, @Param('id') id: string) {
    return this.gpaPoliciesService.delete(orgId, id);
  }

  @Patch(':id/default')
  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  setDefault(@OrgId() orgId: string, @Param('id') id: string) {
    return this.gpaPoliciesService.setDefault(orgId, id);
  }

  @Post('preview')
  preview(@Body() dto: PreviewGpaPolicyDto) {
    return this.gpaPoliciesService.preview(dto);
  }
}
