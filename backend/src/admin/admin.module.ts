import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { UserModule } from '../users/user.module';
import { OrgModule } from '../org/org.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [AuthModule, MailModule, UserModule, OrgModule, SecurityModule],
  controllers: [AdminController, AdminAuthController],
  providers: [AdminService],
})
export class AdminModule {}
