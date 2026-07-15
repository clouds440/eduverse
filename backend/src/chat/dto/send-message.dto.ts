import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CHAT_MENTION_TARGET_TYPES = [
  'USER',
  'EVERYONE',
  'ROLE',
  'RELATED_SCOPE',
] as const;

export const CHAT_MENTION_SCOPE_TYPES = [
  'SECTION',
  'DEPARTMENT',
  'COHORT',
] as const;

export const CHAT_MENTION_AUDIENCES = [
  'EVERYONE',
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'SUB_ADMIN',
  'TEACHER',
  'STUDENT',
  'GUARDIAN',
  'PLATFORM_ADMIN',
  'ORG_MANAGER',
  'FINANCE_MANAGER',
] as const;

export class ChatMentionTargetDto {
  @IsString()
  @IsIn(CHAT_MENTION_TARGET_TYPES)
  type: 'USER' | 'EVERYONE' | 'ROLE' | 'RELATED_SCOPE';

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsIn(CHAT_MENTION_SCOPE_TYPES)
  @IsOptional()
  scopeType?: 'SECTION' | 'DEPARTMENT' | 'COHORT';

  @IsString()
  @IsOptional()
  scopeId?: string;

  @IsString()
  @IsIn(CHAT_MENTION_AUDIENCES)
  @IsOptional()
  audienceRole?: string;
}

export class ChatKeyEnvelopeDto {
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

export class ChatContentHistoryKeyEnvelopeDto {
  @IsString()
  historyKeyId!: string;

  @IsString()
  recipientUserId!: string;

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

export class ChatEncryptedContentDto {
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
  @Type(() => ChatKeyEnvelopeDto)
  keyEnvelopes!: ChatKeyEnvelopeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatContentHistoryKeyEnvelopeDto)
  @IsOptional()
  historyKeyEnvelopes?: ChatContentHistoryKeyEnvelopeDto[];
}

export class SendMessageDto {
  @IsString()
  @IsOptional()
  content?: string;

  @ValidateNested()
  @Type(() => ChatEncryptedContentDto)
  @IsOptional()
  encryptedContent?: ChatEncryptedContentDto;

  @IsString()
  @IsOptional()
  replyToId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUserIds?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMentionTargetDto)
  @IsOptional()
  mentionTargets?: ChatMentionTargetDto[];
}
