import {
  IsOptional,
  IsBoolean,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RegisterTrustedDeviceDto {
  @IsUUID()
  clientDeviceId!: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  displayName?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  deviceType?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  browser?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  os?: string;

  @IsString()
  @MaxLength(4096)
  identityPublicKey!: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  identityPublicKeyFingerprint?: string;

  @IsString()
  @MaxLength(4096)
  @IsOptional()
  identitySigningPublicKey?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  identitySigningPublicKeyFingerprint?: string;

  @IsString()
  @MaxLength(4096)
  keyAgreementPublicKey!: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  keyAgreementPublicKeyFingerprint?: string;

  @IsString()
  @MaxLength(4096)
  @IsOptional()
  signingPublicKey?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  signingPublicKeyFingerprint?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  algorithm?: string;

  @IsBoolean()
  @IsOptional()
  requestApprovalNotification?: boolean;
}
