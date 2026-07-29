import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeacherModule } from '../teacher/teacher.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [AuthModule, NotificationsModule, TeacherModule, FilesModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
