import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard)
@Access(AccessLevel.READ)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @Access(AccessLevel.WRITE)
  async create(
    @Body() dto: CreateAnnouncementDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.announcementsService.createAnnouncement(dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get()
  async getAnnouncements(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadSince') unreadSince?: string,
  ) {
    return this.announcementsService.getAnnouncements(
      {
        id: req.user.id,
        role: req.user.role,
        organizationId: req.user.organizationId,
      },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      unreadSince !== undefined ? parseInt(unreadSince, 10) : undefined,
    );
  }
}
