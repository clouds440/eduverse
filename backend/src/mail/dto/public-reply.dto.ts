import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PublicReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content!: string;
}
