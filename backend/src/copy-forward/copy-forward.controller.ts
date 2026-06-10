import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CopyForwardService } from './copy-forward.service';
import { CopyForwardDto } from './dto/copy-forward.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/enums';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/copy-forward')
export class CopyForwardController {
  constructor(private readonly copyForwardService: CopyForwardService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('preview')
  previewCopyForward(@OrgId() orgId: string, @Body() dto: CopyForwardDto) {
    return this.copyForwardService.previewCopyForward(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  copyForward(@OrgId() orgId: string, @Body() dto: CopyForwardDto) {
    return this.copyForwardService.copyForward(orgId, dto);
  }
}
