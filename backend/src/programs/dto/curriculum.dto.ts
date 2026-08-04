import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CourseRequirementType, CurriculumStatus } from '@/prisma/prisma-client';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export class CreateCurriculumDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  code: string;

  @IsString()
  @IsOptional()
  stageTerminology?: string;
}

export class UpdateCurriculumDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  stageTerminology?: string;
}

export class TransitionCurriculumDto {
  @IsEnum(CurriculumStatus)
  status: CurriculumStatus;

  @IsBoolean()
  @IsOptional()
  defaultForAdmissions?: boolean;
}

export class CreateProgramStageDto {
  @IsString()
  @IsNotEmpty()
  programAcademicCycleId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  code: string;

  @IsInt()
  @Min(1)
  sequence: number;

  @IsString()
  @IsOptional()
  stageType?: string;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minCredits?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  expectedCredits?: number;
}

export class UpdateProgramStageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  stageType?: string;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minCredits?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  expectedCredits?: number;
}

export class CreateCourseRequirementDto {
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsEnum(CourseRequirementType)
  requirementType: CourseRequirementType;

  @IsString()
  @IsOptional()
  groupKey?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  minCourses?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minCredits?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCourseRequirementDto extends CreateCourseRequirementDto {}
