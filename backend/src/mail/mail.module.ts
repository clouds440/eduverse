import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [AuthModule, FilesModule, SecurityModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
