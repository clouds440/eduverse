import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../common/enums';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { GuardiansService } from './guardians.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get()
  getGuardians(@OrgId() orgId: string, @Query('search') search?: string) {
    return this.guardiansService.getGuardians(orgId, search);
  }

  @Roles(Role.GUARDIAN)
  @Get('me/profile')
  getMyGuardianProfile(
    @OrgId() orgId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.guardiansService.getMyGuardianProfile(orgId, req.user.id);
  }

  @Roles(Role.GUARDIAN)
  @Get('me/overview')
  getMyOverview(
    @OrgId() orgId: string,
    @Request() req: { user: { id: string } },
    @Query('studentId') studentId?: string,
  ) {
    return this.guardiansService.getMyOverview(orgId, req.user.id, studentId);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get(':id')
  getGuardian(@OrgId() orgId: string, @Param('id') id: string) {
    return this.guardiansService.getGuardian(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  createGuardian(
    @OrgId() orgId: string,
    @Body() createGuardianDto: CreateGuardianDto,
  ) {
    return this.guardiansService.createGuardian(orgId, createGuardianDto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  updateGuardian(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() updateGuardianDto: UpdateGuardianDto,
  ) {
    return this.guardiansService.updateGuardian(orgId, id, updateGuardianDto);
  }
}
