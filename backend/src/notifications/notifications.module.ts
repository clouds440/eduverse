import { Module, Global, forwardRef } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthModule } from '../auth/auth.module';
import { NOTIFICATIONS_SERVICE } from './notifications.tokens';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATIONS_SERVICE, useExisting: NotificationsService },
  ],
  exports: [NotificationsService, NOTIFICATIONS_SERVICE], // Export so other modules can trigger notifications
})
export class NotificationsModule {}
