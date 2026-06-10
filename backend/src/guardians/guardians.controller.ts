import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../common/enums';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { GuardiansService } from './guardians.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/guardians')
export class GuardiansController {
  constructor(private readonly guardiansService: GuardiansService) {}

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Get()
  getGuardians(@OrgId() orgId: string, @Query('search') search?: string) {
    return this.guardiansService.getGuardians(orgId, search);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Get(':id')
  getGuardian(@OrgId() orgId: string, @Param('id') id: string) {
    return this.guardiansService.getGuardian(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER)
  @Access(AccessLevel.WRITE)
  @Post()
  createGuardian(
    @OrgId() orgId: string,
    @Body() createGuardianDto: CreateGuardianDto,
  ) {
    return this.guardiansService.createGuardian(orgId, createGuardianDto);
  }
}
