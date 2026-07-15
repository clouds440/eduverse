import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MailKeyEnvelopeDto {
  @IsString()
  recipientUserId!: string;

  @IsString()
  trustedDeviceId!: string;

  @IsString()
  @IsOptional()
  senderDeviceId?: string;

  @IsInt()
  deviceKeyVersion!: number;

  @IsString()
  algorithm!: string;

  @IsString()
  wrappedKey!: string;

  @IsString()
  @IsOptional()
  nonce?: string;

  @IsObject()
  @IsOptional()
  associatedData?: Record<string, unknown>;
}

export class MailEncryptedContentDto {
  @IsInt()
  encryptionVersion!: number;

  @IsString()
  algorithm!: string;

  @IsString()
  ciphertext!: string;

  @IsString()
  nonce!: string;

  @IsString()
  @IsOptional()
  authTag?: string;

  @IsObject()
  @IsOptional()
  associatedData?: Record<string, unknown>;

  @IsInt()
  @IsOptional()
  contentKeyVersion?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MailKeyEnvelopeDto)
  keyEnvelopes!: MailKeyEnvelopeDto[];
}
