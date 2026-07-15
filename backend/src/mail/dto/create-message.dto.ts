import { IsString, IsNotEmpty, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MailEncryptedContentDto } from './mail-encrypted-content.dto';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;

  @ValidateNested()
  @Type(() => MailEncryptedContentDto)
  encryptedContent!: MailEncryptedContentDto;
}
