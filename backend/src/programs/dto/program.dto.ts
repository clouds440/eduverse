import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
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
  ProgramType,
} from '@/prisma/prisma-client';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

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

export class ProgramCatalogInputDto {
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
  slug?: string;

  @IsEnum(ProgramType)
  programType: ProgramType;

  @IsString()
  @IsOptional()
  subjectArea?: string;

  @IsString()
  @IsOptional()
  educationLevel?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languageCodes?: string[];

  @IsString()
  @IsOptional()
  credentialType?: string;

  @IsString()
  @IsOptional()
  credentialAwarded?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  learningOutcomes?: string[];

  @IsString()
  @IsOptional()
  entryOverview?: string;

  @IsString()
  @IsOptional()
  awardingBody?: string;

  @IsString()
  @IsOptional()
  accreditationSummary?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationValue?: number;

  @IsEnum(ProgramDurationUnit)
  @IsOptional()
  durationUnit?: ProgramDurationUnit;
}

export class CampusProgramConfigurationInputDto {
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @IsEnum(ProgramStructureType)
  structureType: ProgramStructureType;

  @IsEnum(ProgramProgressionMode)
  progressionMode: ProgramProgressionMode;

  @IsEnum(ProgramCompletionMode)
  completionMode: ProgramCompletionMode;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minimumPassingPercentage?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minimumAttendancePercentage?: number;

}

export class CreateProgramDto extends ProgramCatalogInputDto {
  @ValidateNested()
  @Type(() => CampusProgramConfigurationInputDto)
  campusConfiguration: CampusProgramConfigurationInputDto;

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
  @Type(() => ProgramStageInputDto)
  stages: ProgramStageInputDto[];
}

export class CampusProgramConfigurationUpdateDto {
  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsEnum(ProgramStructureType)
  @IsOptional()
  structureType?: ProgramStructureType;

  @IsEnum(ProgramProgressionMode)
  @IsOptional()
  progressionMode?: ProgramProgressionMode;

  @IsEnum(ProgramCompletionMode)
  @IsOptional()
  completionMode?: ProgramCompletionMode;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minimumPassingPercentage?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minimumAttendancePercentage?: number;
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
  slug?: string;

  @IsEnum(ProgramType)
  @IsOptional()
  programType?: ProgramType;

  @IsString()
  @IsOptional()
  subjectArea?: string;

  @IsString()
  @IsOptional()
  educationLevel?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languageCodes?: string[];

  @IsString()
  @IsOptional()
  credentialType?: string;

  @IsString()
  @IsOptional()
  credentialAwarded?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  learningOutcomes?: string[];

  @IsString()
  @IsOptional()
  entryOverview?: string;

  @IsString()
  @IsOptional()
  awardingBody?: string;

  @IsString()
  @IsOptional()
  accreditationSummary?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationValue?: number;

  @IsEnum(ProgramDurationUnit)
  @IsOptional()
  durationUnit?: ProgramDurationUnit;

  @ValidateNested()
  @Type(() => CampusProgramConfigurationUpdateDto)
  @IsOptional()
  campusConfiguration?: CampusProgramConfigurationUpdateDto;
}

export class ReplaceProgramStructureDto {
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
  @Type(() => ProgramStageInputDto)
  stages: ProgramStageInputDto[];

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
