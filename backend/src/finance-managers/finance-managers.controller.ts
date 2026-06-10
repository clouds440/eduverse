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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateFinanceManagerDto } from './dto/create-finance-manager.dto';
import { UpdateFinanceManagerDto } from './dto/update-finance-manager.dto';
import { FinanceManagersService } from './finance-managers.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Access(AccessLevel.READ)
@Controller('org/finance-managers')
export class FinanceManagersController {
  constructor(private readonly financeManagersService: FinanceManagersService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get()
  getFinanceManagers(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('status') status?: string,
    @Query('deleted') deleted?: string,
  ) {
    return this.financeManagersService.getFinanceManagers(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      sortBy,
      sortOrder,
      status,
      deleted: deleted === 'true',
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get(':id')
  getFinanceManager(@OrgId() orgId: string, @Param('id') id: string) {
    return this.financeManagersService.getFinanceManager(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  createFinanceManager(
    @OrgId() orgId: string,
    @Body() createFinanceManagerDto: CreateFinanceManagerDto,
  ) {
    return this.financeManagersService.createFinanceManager(
      orgId,
      createFinanceManagerDto,
    );
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  updateFinanceManager(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() updateFinanceManagerDto: UpdateFinanceManagerDto,
  ) {
    return this.financeManagersService.updateFinanceManager(
      orgId,
      id,
      updateFinanceManagerDto,
    );
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/restore')
  restoreFinanceManager(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('status') status?: string,
  ) {
    return this.financeManagersService.restoreFinanceManager(
      orgId,
      id,
      status as UserStatus,
    );
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Delete(':id')
  deleteFinanceManager(@OrgId() orgId: string, @Param('id') id: string) {
    return this.financeManagersService.deleteFinanceManager(orgId, id);
  }
}
