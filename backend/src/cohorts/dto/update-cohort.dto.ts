import { IsString, IsOptional, IsArray, IsEnum, Matches, MaxLength, ValidateIf, IsNotEmpty } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';
import { CohortLifecycleStatus, ProgramClassificationStatus } from '../../common/enums';

export class UpdateCohortDto {
  @IsEnum(ProgramClassificationStatus)
  @IsOptional()
  programClassificationStatus?: ProgramClassificationStatus;

  @ValidateIf((dto) => dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED || dto.programAcademicCycleId !== undefined)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  programAcademicCycleId?: string;

  @ValidateIf((dto) => dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED || dto.programStageId !== undefined)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  programStageId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  academicCycleId?: string;

  @IsEnum(CohortLifecycleStatus)
  @IsOptional()
  status?: CohortLifecycleStatus;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain letters, numbers, underscores, and hyphens' })
  code?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectionIds?: string[];
}
