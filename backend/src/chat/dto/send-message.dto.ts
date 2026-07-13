import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
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

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

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
