import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional, Matches, MaxLength, ValidateIf } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';
import { CohortLifecycleStatus, ProgramClassificationStatus } from '../../common/enums';

export class CreateCohortDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain letters, numbers, underscores, and hyphens' })
  code: string;

  @IsString()
  @IsNotEmpty()
  academicCycleId: string;

  @IsEnum(CohortLifecycleStatus)
  @IsOptional()
  status?: CohortLifecycleStatus;

  @IsEnum(ProgramClassificationStatus)
  programClassificationStatus: ProgramClassificationStatus;

  @ValidateIf((dto) => dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED)
  @IsString()
  @IsNotEmpty()
  programAcademicCycleId?: string;

  @ValidateIf((dto) => dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED)
  @IsString()
  @IsNotEmpty()
  programStageId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectionIds?: string[];
}
