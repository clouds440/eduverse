import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { RoomType } from '@/prisma/prisma-client';
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

  private assertImageFile(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    if (!allowedImageTypes.has(file.mimetype)) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed.`);
    }
  }

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
  @Patch(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: new CloudinaryStorage({
        cloudinary,
        params: (req: any, file: any) => {
          const roomId = req.params.id as string;
          const fileName = file.originalname.replace(/\s+/g, '-').split('.').slice(0, -1).join('.');
          return {
            folder: `eduverse/rooms/${roomId}/image`,
            resource_type: 'image',
            public_id: `${Date.now()}-${fileName}`,
          };
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  updateImage(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.assertImageFile(file);
    return this.roomsService.updateImage(orgId, id, file);
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
