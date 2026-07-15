import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsIn,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MailStatus } from '../../common/enums';
import { MailEncryptedContentDto } from './mail-encrypted-content.dto';

export class CreateMailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;

  @IsString()
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;

  @IsString()
  @IsOptional()
  targetRole?: string;

  @IsString({ each: true })
  @IsOptional()
  assigneeIds?: string[];

  @IsOptional()
  @IsEnum(MailStatus)
  status?: MailStatus;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  noReply?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailEncryptedContentDto)
  encryptedSubject?: MailEncryptedContentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailEncryptedContentDto)
  encryptedMessage?: MailEncryptedContentDto;
}
