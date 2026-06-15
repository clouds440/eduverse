import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RoomType } from '@prisma/client';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { Roles } from '../auth/roles.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomsService } from './rooms.service';
import { UpdateRoomDto } from './dto/update-room.dto';

@Access(AccessLevel.READ)
@Controller('org/rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(orgId, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get()
  findAll(
    @OrgId() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('isActive') isActive?: string,
    @Query('buildingId') buildingId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('type') type?: RoomType,
  ) {
    return this.roomsService.getRooms(orgId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      sortBy,
      sortOrder,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      buildingId,
      departmentId,
      type,
    });
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN, Role.FINANCE_MANAGER)
  @Get(':id')
  findOne(@OrgId() orgId: string, @Param('id') id: string) {
    return this.roomsService.getRoom(orgId, id);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.updateRoom(orgId, id, dto);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Access(AccessLevel.WRITE)
  @Patch(':id/active')
  setActive(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean | string,
  ) {
    return this.roomsService.setActive(orgId, id, isActive === true || isActive === 'true');
  }
}
