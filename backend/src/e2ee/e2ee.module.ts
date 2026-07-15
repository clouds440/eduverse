import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { E2eeController } from './e2ee.controller';
import { E2eeService } from './e2ee.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [E2eeController],
  providers: [E2eeService],
  exports: [E2eeService],
})
export class E2eeModule {}
