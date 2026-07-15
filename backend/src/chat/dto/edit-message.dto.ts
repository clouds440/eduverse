import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ChatEncryptedContentDto } from './send-message.dto';

export class EditMessageDto {
  @IsString()
  @IsOptional()
  content?: string;

  @ValidateNested()
  @Type(() => ChatEncryptedContentDto)
  @IsOptional()
  encryptedContent?: ChatEncryptedContentDto;
}
