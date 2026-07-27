import { ThemeMode } from '@/prisma/prisma-client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailTwoFactorEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  deviceTwoFactorEnabled?: boolean;

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
