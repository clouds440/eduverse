import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApproveDeviceHistoryKeyEnvelopeDto {
  @IsUUID()
  historyKeyId!: string;

  @IsUUID()
  recipientUserId!: string;

  @IsUUID()
  trustedDeviceId!: string;

  @IsOptional()
  @IsUUID()
  senderDeviceId?: string;

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
}

export class ApproveTrustedDeviceDto {
  @IsUUID()
  approverDeviceId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveDeviceHistoryKeyEnvelopeDto)
  historyKeyEnvelopes?: ApproveDeviceHistoryKeyEnvelopeDto[];
}
