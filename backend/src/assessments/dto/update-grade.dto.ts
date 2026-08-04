import { IsNumber, IsOptional, IsString, IsEnum, MaxLength, Min } from 'class-validator';
import { GradeStatus } from '@/prisma/prisma-client';

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

  @IsString()
  @IsOptional()
  @MaxLength(100)
  answerbookReferenceNumber?: string | null;
}
