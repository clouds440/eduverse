import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { SecurityModule } from '../security/security.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';
import { SecurityService as AuthSecurityService } from './security.service';
import { SessionService } from './session.service';
import { UserPreferencesService } from './user-preferences.service';
import { TwoFactorService } from './two-factor.service';
import { EmailTemplatesModule } from '../common/email-templates/email-templates.module';
import { UserSettingsContextService } from './user-settings-context.service';

// ...

@Module({
  imports: [
    PassportModule,
    SecurityModule,
    EmailTemplatesModule,
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
    UserPreferencesService,
    TwoFactorService,
    UserSettingsContextService,
  ],
  exports: [AuthService, UserSettingsContextService],
})
export class AuthModule {}
