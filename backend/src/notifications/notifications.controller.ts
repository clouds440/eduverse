import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  NotificationsService,
  type WebPushTestDto,
  type WebPushSubscriptionDto,
  type WebPushUnsubscribeDto,
} from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

import {
  Access,
  AnonymousAccess,
} from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';

@UseGuards(JwtAuthGuard)
@Access(AccessLevel.READ)
@AnonymousAccess()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getUserNotifications(
    @Request() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      this.getClientDeviceId(req),
    );
  }

  @Get('dropdown')
  async getDropdownNotifications(
    @Request() req: AuthenticatedRequest,
    @Query('readPage') readPage?: string,
    @Query('readLimit') readLimit?: string,
  ) {
    return this.notificationsService.getDropdownNotifications(
      req.user.id,
      readPage ? parseInt(readPage, 10) : 1,
      readLimit ? parseInt(readLimit, 10) : 10,
      this.getClientDeviceId(req),
    );
  }

  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.deleteNotification(id, req.user.id, this.getClientDeviceId(req));
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.id, this.getClientDeviceId(req));
  }

  @Patch('clear-category/:category')
  async markCategoryAsRead(
    @Param('category') category: 'CHAT' | 'MAIL',
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markCategoryAsRead(req.user.id, category, this.getClientDeviceId(req));
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAsRead(id, req.user.id, this.getClientDeviceId(req));
  }

  @Get('push/config')
  getPushConfig() {
    return this.notificationsService.getPushConfig();
  }

  @Post('push/subscribe')
  async subscribeToPush(
    @Request() req: AuthenticatedRequest,
    @Body() subscription: WebPushSubscriptionDto,
  ) {
    return this.notificationsService.subscribeToPush(req.user.id, subscription);
  }

  @Post('push/unsubscribe')
  async unsubscribeFromPush(
    @Request() req: AuthenticatedRequest,
    @Body() subscription: WebPushUnsubscribeDto,
  ) {
    return this.notificationsService.unsubscribeFromPush(
      req.user.id,
      subscription,
    );
  }

  @Post('push/test')
  async testPushNotification(
    @Request() req: AuthenticatedRequest,
    @Body() body: WebPushTestDto,
  ) {
    await this.notificationsService.sendTestPushNotification(
      req.user.id,
      {
        title: 'Test Notification',
        body: 'This is a test web push notification from EduVerse!',
        url: '/',
      },
      body?.endpoint,
    );
    return { success: true, message: 'Test notification dispatched' };
  }

  private getClientDeviceId(req: AuthenticatedRequest) {
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const value = headers['x-client-device-id'];
    return Array.isArray(value) ? value[0] : value;
  }
}
