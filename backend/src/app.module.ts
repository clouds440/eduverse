import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { OrgModule } from './org/org.module';
import { FilesModule } from './files/files.module';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { MailModule } from './mail/mail.module';
import { UserModule } from './users/user.module';

import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AccessGuard } from './common/access-control/access.guard';
import { CourseMaterialsModule } from './course-materials/course-materials.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AcademicCyclesModule } from './academic-cycles/academic-cycles.module';
import { CohortsModule } from './cohorts/cohorts.module';
import { TranscriptsModule } from './transcripts/transcripts.module';
import { PromotionsModule } from './promotions/promotions.module';
import { CopyForwardModule } from './copy-forward/copy-forward.module';
import { FinanceModule } from './finance/finance.module';
import { GpaModule } from './gpa/gpa.module';
import { GuardiansModule } from './guardians/guardians.module';
import { SubAdminsModule } from './sub-admins/sub-admins.module';
import { FinanceManagersModule } from './finance-managers/finance-managers.module';
import { DepartmentsModule } from './departments/departments.module';
import { BuildingsModule } from './buildings/buildings.module';
import { RoomsModule } from './rooms/rooms.module';
import { ImportsModule } from './imports/imports.module';
import { HolidaysModule } from './holidays/holidays.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    AdminModule,
    OrgModule,
    FilesModule,
    PrismaModule,
    EventsModule,
    MailModule,
    UserModule,
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL!, 10),
        limit: parseInt(process.env.THROTTLE_LIMIT!, 10),
      },
    ]),
    ChatModule,
    NotificationsModule,
    AnnouncementsModule,
    CourseMaterialsModule,
    AcademicCyclesModule,
    CohortsModule,
    TranscriptsModule,
    PromotionsModule,
    CopyForwardModule,
    FinanceModule,
    GpaModule,
    GuardiansModule,
    SubAdminsModule,
    FinanceManagersModule,
    DepartmentsModule,
    BuildingsModule,
    RoomsModule,
    ImportsModule,
    HolidaysModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AccessGuard,
    },
  ],
})
export class AppModule {}
