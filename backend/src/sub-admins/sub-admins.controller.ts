import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role, UserStatus } from '../common/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSubAdminDto } from './dto/create-sub-admin.dto';
import { UpdateSubAdminDto } from './dto/update-sub-admin.dto';
import { SubAdminsService } from './sub-admins.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/sub-admins')
export class SubAdminsController {
  constructor(private readonly subAdminsService: SubAdminsService) {}

  @Roles(Role.ORG_ADMIN)
  @Get()
  getSubAdmins(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('status') status?: string,
    @Query('deleted') deleted?: string,
  ) {
    return this.subAdminsService.getSubAdmins(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy,
      sortOrder,
      status,
      deleted: deleted === 'true',
    });
  }

  @Roles(Role.ORG_ADMIN)
  @Get(':id')
  getSubAdmin(@OrgId() orgId: string, @Param('id') id: string) {
    return this.subAdminsService.getSubAdmin(orgId, id);
  }

  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  createSubAdmin(
    @OrgId() orgId: string,
    @Body() createSubAdminDto: CreateSubAdminDto,
  ) {
    return this.subAdminsService.createSubAdmin(orgId, createSubAdminDto);
  }

  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  updateSubAdmin(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() updateSubAdminDto: UpdateSubAdminDto,
  ) {
    return this.subAdminsService.updateSubAdmin(
      orgId,
      id,
      updateSubAdminDto,
    );
  }

  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/restore')
  restoreSubAdmin(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('status') status?: string,
  ) {
    return this.subAdminsService.restoreSubAdmin(
      orgId,
      id,
      status as UserStatus,
    );
  }

  @Roles(Role.ORG_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  deleteSubAdmin(@OrgId() orgId: string, @Param('id') id: string) {
    return this.subAdminsService.deleteSubAdmin(orgId, id);
  }
}
