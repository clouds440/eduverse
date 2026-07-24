import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { OrgStatus, Role } from '../common/enums';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreatePlatformAdminDto } from './dto/create-platform-admin.dto';
import { UpdatePlatformAdminDto } from './dto/update-platform-admin.dto';
import { User } from '../common/decorators/user.decorator';
import type { User as UserEntity } from '@/prisma/prisma-client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(Role.SUPER_ADMIN, Role.PLATFORM_ADMIN)
  @Get('organizations')
  async getOrganizations(
    @Query('status') status?: OrgStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('type') type?: string,
  ) {
    return this.adminService.getOrganizations({
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy,
      sortOrder,
      type,
    });
  }

  @Roles(Role.SUPER_ADMIN, Role.PLATFORM_ADMIN)
  @Get('stats')
  async getAdminStats(@User() user: UserEntity) {
    return this.adminService.getAdminStats({
      id: user.id,
      role: user.role,
      organizationId: user.organizationId,
      name: user.name || null,
      email: user.email,
    });
  }

  @Roles(Role.SUPER_ADMIN)
  @Get('audit-logs')
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('action') action?: string,
  ) {
    return this.adminService.getAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      action,
    });
  }

  @Roles(Role.SUPER_ADMIN, Role.PLATFORM_ADMIN)
  @Patch('organizations/:id/approve')
  approveOrganization(@Param('id') id: string, @User() admin: UserEntity) {
    return this.adminService.approveOrganization(id, admin);
  }

  @Roles(Role.SUPER_ADMIN, Role.PLATFORM_ADMIN)
  @Patch('organizations/:id/reject')
  rejectOrganization(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @User() admin: UserEntity,
  ) {
    return this.adminService.updateOrganizationStatus(id, OrgStatus.REJECTED, reason, admin);
  }

  @Roles(Role.SUPER_ADMIN, Role.PLATFORM_ADMIN)
  @Patch('organizations/:id/suspend')
  suspendOrganization(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @User() admin: UserEntity,
  ) {
    return this.adminService.updateOrganizationStatus(id, OrgStatus.SUSPENDED, reason, admin);
  }

  // --- Platform Admins ---
  @Roles(Role.SUPER_ADMIN)
  @Get('platform-admins')
  async getPlatformAdmins(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getPlatformAdmins({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
    });
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('platform-admins')
  createPlatformAdmin(@Body() createPlatformAdminDto: CreatePlatformAdminDto) {
    return this.adminService.createPlatformAdmin(createPlatformAdminDto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('platform-admins/:id')
  updatePlatformAdmin(
    @Param('id') id: string,
    @Body() updatePlatformAdminDto: UpdatePlatformAdminDto,
  ) {
    return this.adminService.updatePlatformAdmin(id, updatePlatformAdminDto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete('platform-admins/:id')
  deletePlatformAdmin(@Param('id') id: string) {
    return this.adminService.deletePlatformAdmin(id);
  }
}
