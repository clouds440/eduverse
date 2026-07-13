import { IsString, IsArray, IsOptional, IsIn } from 'class-validator';

export class ReassignStudentsDto {
  @IsIn(['cohort', 'section'])
  @IsOptional()
  sourceType?: 'cohort' | 'section';

  @IsString()
  @IsOptional()
  fromCycleId?: string;

  @IsString()
  @IsOptional()
  toCycleId?: string;

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
}
