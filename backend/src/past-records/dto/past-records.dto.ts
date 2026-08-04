import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ProgramClassificationStatus } from '@/prisma/prisma-client';

export class PastRecordFiltersDto {
  @IsString()
  @IsOptional()
  cycleId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  programId?: string;

  @IsString()
  @IsOptional()
  cohortId?: string;

  @IsString()
  @IsOptional()
  studentId?: string;

  @IsEnum(ProgramClassificationStatus)
  @IsOptional()
  classification?: ProgramClassificationStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
