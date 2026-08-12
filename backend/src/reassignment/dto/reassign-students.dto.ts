import { IsString, IsArray, IsOptional, IsIn, IsNotEmpty, IsBoolean } from 'class-validator';

export class ReassignStudentsDto {
  @IsIn(['cohort', 'section'])
  @IsOptional()
  sourceType?: 'cohort' | 'section';

  @IsString()
  @IsOptional()
  fromCycleId?: string;

  @IsString()
  @IsNotEmpty()
  toCycleId: string;

  @IsString()
  @IsOptional()
  fromCohortId?: string;

  @IsString()
  @IsOptional()
  fromSectionId?: string;

  @IsString()
  @IsOptional()
  toCohortId?: string;

  @IsString()
  @IsOptional()
  toSectionId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludedStudentIds?: string[];

  @IsBoolean()
  @IsOptional()
  wasExcluded?: boolean;

  @IsIn(['PRESERVE_ONLY', 'PERCENTAGE_ADJUSTMENT'])
  @IsOptional()
  attendanceTransferMode?: 'PRESERVE_ONLY' | 'PERCENTAGE_ADJUSTMENT';

  @IsString()
  @IsOptional()
  transferDate?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
