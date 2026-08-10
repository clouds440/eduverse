import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, IsNotEmpty, Matches, MaxLength, ValidateNested } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';
import { HEX_COLOR_PATTERN } from '../section-colors';
import { SectionLifecycleStatus } from '../../common/enums';

export class SectionProgramMappingInputDto {
  @IsString()
  @IsNotEmpty()
  programStageOfferingId!: string;

  @IsString()
  @IsNotEmpty()
  stageCourseRequirementId!: string;
}

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain letters, numbers, underscores, and hyphens' })
  code: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  defaultRoomId?: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  academicCycleId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionProgramMappingInputDto)
  @IsOptional()
  programMappings?: SectionProgramMappingInputDto[];

  @IsEnum(SectionLifecycleStatus)
  @IsOptional()
  status?: SectionLifecycleStatus;

  @IsString()
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: 'Color must be a valid hex color like #3B82F6' })
  color?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  teacherIds?: string[];
}
