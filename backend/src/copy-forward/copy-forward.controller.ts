import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CopyForwardService } from './copy-forward.service';
import { CopyForwardDto } from './dto/copy-forward.dto';
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
@Controller('org/copy-forward')
export class CopyForwardController {
  constructor(private readonly copyForwardService: CopyForwardService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post('preview')
  previewCopyForward(
    @OrgId() orgId: string,
    @Body() dto: CopyForwardDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.copyForwardService.previewCopyForward(orgId, dto, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  copyForward(
    @OrgId() orgId: string,
    @Body() dto: CopyForwardDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.copyForwardService.copyForward(orgId, dto, req.user);
  }
}
