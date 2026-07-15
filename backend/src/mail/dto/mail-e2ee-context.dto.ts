import { IsOptional, IsString } from 'class-validator';

export class MailE2eeContextDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  targetRole?: string;

  @IsString({ each: true })
  @IsOptional()
  assigneeIds?: string[];
}
