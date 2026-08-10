import { Body, Controller, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { ApplyBulkProgressionDto, ProgressionWorkbenchPreviewDto } from './dto/progression-workbench.dto';
import { ProgressionWorkbenchService } from './progression-workbench.service';

@Controller('org/progression-workbench')
@Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
export class ProgressionWorkbenchController {
  constructor(private readonly service: ProgressionWorkbenchService) {}

  @Access(AccessLevel.READ)
  @Post('preview')
  preview(@OrgId() orgId: string, @Body() dto: ProgressionWorkbenchPreviewDto, @Req() req: AuthenticatedRequest) {
    return this.service.preview(orgId, dto, req.user);
  }

  @Access(AccessLevel.WRITE)
  @Post('apply')
  apply(@OrgId() orgId: string, @Body() dto: ApplyBulkProgressionDto, @Req() req: AuthenticatedRequest) {
    return this.service.apply(orgId, dto, req.user);
  }
}
