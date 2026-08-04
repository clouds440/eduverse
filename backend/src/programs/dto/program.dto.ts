import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
import {
  CourseRequirementType,
  ProgramCompletionMode,
  ProgramDurationUnit,
  ProgramProgressionMode,
  ProgramStatus,
  ProgramStructureType,
} from '@/prisma/prisma-client';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export enum ProgramCycleInputKind {
  EXISTING = 'EXISTING',
  NEW = 'NEW',
}

export class ProgramCourseRequirementInputDto {
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

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProgramStageInputDto {
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramCourseRequirementInputDto)
  courseRequirements: ProgramCourseRequirementInputDto[];
}

export class ProgramCycleInputDto {
  @IsEnum(ProgramCycleInputKind)
  kind: ProgramCycleInputKind;

  @IsString()
  @IsOptional()
  academicCycleId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  @IsOptional()
  code?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  gpaPolicyId?: string;

  @ValidateNested()
  @Type(() => ProgramStageInputDto)
  stage: ProgramStageInputDto;
}

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  code: string;

  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProgramStructureType)
  structureType: ProgramStructureType;

  @IsEnum(ProgramProgressionMode)
  progressionMode: ProgramProgressionMode;

  @IsEnum(ProgramCompletionMode)
  completionMode: ProgramCompletionMode;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationValue?: number;

  @IsEnum(ProgramDurationUnit)
  @IsOptional()
  durationUnit?: ProgramDurationUnit;

  @IsBoolean()
  @IsOptional()
  isVisibleForAdmissions?: boolean;

  @IsString()
  @IsOptional()
  admissionsLabel?: string;

  @IsString()
  @IsOptional()
  admissionsDescription?: string;

  @IsString()
  @IsNotEmpty()
  curriculumName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  curriculumCode: string;

  @IsString()
  @IsOptional()
  stageTerminology?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramCycleInputDto)
  cycles: ProgramCycleInputDto[];
}

export class UpdateProgramDto {
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
  departmentId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProgramStructureType)
  @IsOptional()
  structureType?: ProgramStructureType;

  @IsEnum(ProgramProgressionMode)
  @IsOptional()
  progressionMode?: ProgramProgressionMode;

  @IsEnum(ProgramCompletionMode)
  @IsOptional()
  completionMode?: ProgramCompletionMode;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationValue?: number;

  @IsEnum(ProgramDurationUnit)
  @IsOptional()
  durationUnit?: ProgramDurationUnit;

  @IsBoolean()
  @IsOptional()
  isVisibleForAdmissions?: boolean;

  @IsString()
  @IsOptional()
  admissionsLabel?: string;

  @IsString()
  @IsOptional()
  admissionsDescription?: string;
}

export class ReplaceProgramCyclesDto {
  @IsInt()
  @Min(1)
  configurationVersion: number;

  @IsString()
  @IsNotEmpty()
  changeReason: string;

  @IsString()
  @IsNotEmpty()
  curriculumName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  curriculumCode: string;

  @IsString()
  @IsOptional()
  stageTerminology?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramCycleInputDto)
  cycles: ProgramCycleInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProgramDto)
  metadata?: UpdateProgramDto;
}

export class TransitionProgramDto {
  @IsEnum(ProgramStatus)
  status: ProgramStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
