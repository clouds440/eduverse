import { TwoFactorMethod, ThemeMode } from '@/prisma/prisma-client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsBoolean()
  twoFactorEnabled?: boolean;

  @IsOptional()
  @IsEnum(TwoFactorMethod)
  twoFactorMethod?: TwoFactorMethod;

  @IsOptional()
  @IsEnum(ThemeMode)
  themeMode?: ThemeMode;

  @IsOptional()
  @IsBoolean()
  loginNotificationEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  loginNotificationPush?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;
}
