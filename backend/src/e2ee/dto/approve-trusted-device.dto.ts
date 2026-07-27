import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class DeviceGrantContentEnvelopeDto {
  @IsUUID()
  messageId!: string;

  @IsUUID()
  encryptedContentId!: string;

  @IsString()
  algorithm!: string;

  @IsString()
  wrappedKey!: string;

  @IsOptional()
  @IsString()
  nonce?: string;

  @IsOptional()
  @IsObject()
  associatedData?: Record<string, unknown>;
}

export class ChatDeviceHistoryGrantDto {
  @IsUUID()
  chatId!: string;

  @IsInt()
  deviceKeyVersion!: number;

  @IsString()
  algorithm!: string;

  @IsString()
  wrappedKey!: string;

  @IsOptional()
  @IsString()
  nonce?: string;

  @IsOptional()
  @IsObject()
  associatedData?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceGrantContentEnvelopeDto)
  contentEnvelopes!: DeviceGrantContentEnvelopeDto[];
}

export class ApproveTrustedDeviceDto {
  @IsUUID()
  approverDeviceId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatDeviceHistoryGrantDto)
  chatGrants?: ChatDeviceHistoryGrantDto[];

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}
