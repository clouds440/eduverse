import { IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { GradeStatus } from '@prisma/client';

export class UpdateGradeDto {
  @IsNumber()
  @Min(0)
  marksObtained: number;

  @IsString()
  @IsOptional()
  feedback?: string;

  @IsEnum(GradeStatus)
  @IsOptional()
  status?: GradeStatus;

  @IsString()
  @IsOptional()
  correctionReason?: string;
}
