import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MailService } from './mail.service';
import { CreateMailDto } from './dto/create-mail.dto';
import { UpdateMailDto } from './dto/update-mail.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard)
@Access(AccessLevel.NONE)
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post()
  async create(
    @Body() dto: CreateMailDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.mailService.createMail(dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    return this.mailService.getUnreadCount({
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Get()
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('direction') direction?: string,
  ) {
    return this.mailService.getMails(
      {
        id: req.user.id,
        role: req.user.role,
        organizationId: req.user.organizationId,
        name: req.user.name,
        email: req.user.email,
      },
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        search,
        sortBy,
        sortOrder,
        status,
        category,
        direction,
      },
    );
  }

  @Get('contacts')
  async getContacts(
    @Request() req: AuthenticatedRequest,
    @Query('search') search?: string,
  ) {
    return this.mailService.getContactableUsers(
      {
        id: req.user.id,
        role: req.user.role,
        organizationId: req.user.organizationId,
        name: req.user.name,
        email: req.user.email,
      },
      search,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.mailService.getMailById(id, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMailDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.mailService.updateMail(id, dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
      name: req.user.name,
      email: req.user.email,
    });
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.mailService.addMessage(id, dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
      name: req.user.name,
      email: req.user.email,
    });
  }
}
