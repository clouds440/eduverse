import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryKeyDeviceEnvelopeDto {
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

export class RegisterChatHistoryKeyDto {
  @IsString()
  algorithm!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryKeyDeviceEnvelopeDto)
  deviceEnvelopes!: ChatHistoryKeyDeviceEnvelopeDto[];
}
