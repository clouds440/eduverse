import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { AdminProgramOfferingsService } from './admin-program-offerings.service';
import {
  CreateProgramOfferingDto,
  CreateProviderLocationDto,
  UpdateProgramOfferingDto,
} from './dto/program-offering.dto';

@Access(AccessLevel.READ)
@Controller('org/program-offerings')
export class AdminProgramOfferingsController {
  constructor(private readonly offerings: AdminProgramOfferingsService) {}

  @Get()
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  list(
    @OrgId() orgId: string,
    @Req() req: AuthenticatedRequest,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.offerings.list(orgId, req.user, academicCycleId, programId);
  }

  @Get('provider-locations/list')
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  listLocations(@OrgId() orgId: string) {
    return this.offerings.listLocations(orgId);
  }

  @Post('provider-locations')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  createLocation(@OrgId() orgId: string, @Body() dto: CreateProviderLocationDto) {
    return this.offerings.createLocation(orgId, dto);
  }

  @Get(':id')
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  get(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.offerings.get(orgId, id, req.user);
  }

  @Get(':id/readiness')
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  readiness(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.offerings.readiness(orgId, id, req.user);
  }

  @Post()
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  create(@OrgId() orgId: string, @Body() dto: CreateProgramOfferingDto, @Req() req: AuthenticatedRequest) {
    return this.offerings.create(orgId, dto, req.user);
  }

  @Patch(':id')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  update(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateProgramOfferingDto, @Req() req: AuthenticatedRequest) {
    return this.offerings.update(orgId, id, dto, req.user);
  }

}
