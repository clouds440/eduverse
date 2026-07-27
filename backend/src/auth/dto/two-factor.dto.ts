import { TwoFactorMethod } from '@/prisma/prisma-client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { RegisterTrustedDeviceDto } from '../../e2ee/dto/register-trusted-device.dto';
import { ChatDeviceHistoryGrantDto } from '../../e2ee/dto/approve-trusted-device.dto';

export class TemporaryTwoFactorTokenDto {
  @IsString()
  @IsNotEmpty()
  temporaryToken!: string;
}

export class SelectTwoFactorMethodDto extends TemporaryTwoFactorTokenDto {
  @IsEnum(TwoFactorMethod)
  method!: TwoFactorMethod;
}

export class VerifyTwoFactorEmailDto extends TemporaryTwoFactorTokenDto {
  @Matches(/^\d{6}$/)
  code!: string;
}

export class RegisterPendingTwoFactorDeviceDto extends TemporaryTwoFactorTokenDto {
  @ValidateNested()
  @Type(() => RegisterTrustedDeviceDto)
  device!: RegisterTrustedDeviceDto;
}

export class ApproveTwoFactorDeviceDto {
  @IsString()
  @IsNotEmpty()
  pendingLoginId!: string;

  @IsString()
  @IsNotEmpty()
  clientDeviceId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatDeviceHistoryGrantDto)
  chatGrants?: ChatDeviceHistoryGrantDto[];

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
