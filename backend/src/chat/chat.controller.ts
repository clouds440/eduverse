import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateGroupChatDto } from './dto/create-group.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { RegisterChatHistoryKeyDto } from './dto/register-chat-history-key.dto';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { ChatParticipantRole, CommunicationChannel, Role } from '@/prisma/prisma-client';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard)
@Access(AccessLevel.READ)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Patch(':id')
  @Access(AccessLevel.WRITE)
  async updateChat(
    @Param('id') id: string,
    @Body() dto: UpdateChatDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.updateChat(id, dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    return this.chatService.getUnreadCount({
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get('users')
  async searchUsers(
    @Query('search') search: string,
    @Query('role') role: Role,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.searchUsers(search || '', {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    }, role);
  }

  @Get('preset-users')
  async getPresetUsers(
    @Query('preset') preset: string,
    @Query('cohortId') cohortId: string | undefined,
    @Query('departmentId') departmentId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.getPresetUsers(preset || '', {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    }, { cohortId, departmentId });
  }

  @Get('communication/blocks')
  async getCommunicationBlocks(
    @Query('channel') channel: CommunicationChannel | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.getCommunicationBlocks({
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    }, channel);
  }

  @Post('communication/blocks')
  @Access(AccessLevel.WRITE)
  async blockCommunicationTarget(
    @Body() dto: { targetUserId?: string; channel?: CommunicationChannel },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.blockCommunicationTarget(dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Delete('communication/blocks/:targetUserId')
  @Access(AccessLevel.WRITE)
  async unblockCommunicationTarget(
    @Param('targetUserId') targetUserId: string,
    @Query('channel') channel: CommunicationChannel | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.unblockCommunicationTarget(targetUserId, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    }, channel);
  }

  @Post('direct')
  @Access(AccessLevel.WRITE)
  async createDirectChat(
    @Body() dto: CreateDirectChatDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.createDirectChat(dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Post('group')
  @Access(AccessLevel.WRITE)
  async createGroupChat(
    @Body() dto: CreateGroupChatDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.createGroupChat(dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get()
  async getUserChats(@Request() req: AuthenticatedRequest) {
    return this.chatService.getUserChats({
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get(':id')
  async getChat(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.getChat(id, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get(':id/mention-options')
  async getMentionOptions(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.getMentionOptions(id, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get(':id/e2ee-context')
  async getChatE2eeContext(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.getChatE2eeContext(id, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Post(':id/e2ee/history-keys')
  @Access(AccessLevel.WRITE)
  async registerChatHistoryKey(
    @Param('id') id: string,
    @Body() dto: RegisterChatHistoryKeyDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.registerChatHistoryKey(id, dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Get(':id/messages')
  async getChatMessages(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('aroundId') aroundId?: string,
  ) {
    return this.chatService.getChatMessages(
      id,
      {
        id: req.user.id,
        role: req.user.role,
        organizationId: req.user.organizationId,
      },
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        aroundId,
      },
    );
  }

  @Post(':id/messages')
  @Access(AccessLevel.WRITE)
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.sendMessage(id, dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Patch([':id/read', ':id/read/:messageId'])
  @Access(AccessLevel.WRITE)
  async markAsRead(
    @Param('id') id: string,
    @Param('messageId') messageId?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    return this.chatService.markAsRead(id, messageId, {
      id: req!.user.id,
      role: req!.user.role,
      organizationId: req!.user.organizationId,
    });
  }

  @Post(':id/participants')
  @Access(AccessLevel.WRITE)
  async addParticipants(
    @Param('id') id: string,
    @Body() dto: AddParticipantsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.addParticipants(id, dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Post(':id/local-state')
  @Access(AccessLevel.WRITE)
  async updateChatLocalState(
    @Param('id') id: string,
    @Body() body: { hide?: boolean; clear?: boolean },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.updateChatLocalState(id, req.user.id, body);
  }

  @Post([':id/participants/:userId/remove', ':id/participants/remove/:userId'])
  @Access(AccessLevel.WRITE)
  async removeParticipant(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.removeParticipant(id, userId, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Patch(':id/participants/:userId/role')
  @Access(AccessLevel.WRITE)
  async updateParticipantRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: 'ADMIN' | 'MOD' | 'MEMBER',
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.updateParticipantRole(id, userId, role as ChatParticipantRole, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Post([':id/messages/:messageId/delete', ':id/messages/delete/:messageId'])
  @Access(AccessLevel.WRITE)
  async deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.deleteMessage(id, messageId, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }

  @Patch(':id/messages/:messageId')
  @Access(AccessLevel.WRITE)
  async editMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.editMessage(id, messageId, dto, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId,
    });
  }
}
