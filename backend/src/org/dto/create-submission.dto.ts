import { IsString, IsNotEmpty, IsOptional, IsUrl, MaxLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  assessmentId: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  message?: string;
}
