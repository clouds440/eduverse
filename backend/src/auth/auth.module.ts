import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityModule } from '../security/security.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailTemplateService } from './email-template.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { SecurityService as AuthSecurityService } from './security.service';
import { SessionService } from './session.service';
import { UserPreferencesService } from './user-preferences.service';

// ...

@Module({
  imports: [
    PassportModule,
    SecurityModule,
    forwardRef(() => NotificationsModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    SessionService,
    AuthSecurityService,
    PasswordResetService,
    EmailVerificationService,
    EmailTemplateService,
    UserPreferencesService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
