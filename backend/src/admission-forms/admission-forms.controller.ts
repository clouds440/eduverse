import { Body, Controller, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { AdmissionFormsService } from './admission-forms.service';
import { BindOfferingApplicationFormDto, CreateAdmissionFormDto, UpdateAdmissionFormVersionDto } from './dto/admission-form.dto';

@Access(AccessLevel.READ)
@Controller('org/admission-forms')
export class AdmissionFormsController {
  constructor(private readonly forms: AdmissionFormsService) {}

  @Get()
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  list(@OrgId() orgId: string, @Req() req: AuthenticatedRequest) {
    return this.forms.list(orgId, req.user.id);
  }

  @Get(':id')
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.forms.get(orgId, id);
  }

  @Post()
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  create(@OrgId() orgId: string, @Body() dto: CreateAdmissionFormDto, @Req() req: AuthenticatedRequest) {
    return this.forms.create(orgId, dto, req.user.id);
  }

  @Post(':id/versions')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  createVersion(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.forms.createDraftVersion(orgId, id, req.user.id);
  }

  @Put('versions/:id')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  updateVersion(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateAdmissionFormVersionDto) {
    return this.forms.updateDraft(orgId, id, dto);
  }

  @Patch('versions/:id/publish')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  publish(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.forms.publish(orgId, id, req.user.id);
  }

  @Put('offerings/:offeringId')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  bindOffering(@OrgId() orgId: string, @Param('offeringId') offeringId: string, @Body() dto: BindOfferingApplicationFormDto) {
    return this.forms.bindOffering(orgId, offeringId, dto);
  }
}
