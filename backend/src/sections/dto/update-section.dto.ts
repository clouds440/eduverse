import { IsArray, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';
import { HEX_COLOR_PATTERN } from '../section-colors';
import { ProgramClassificationStatus, SectionLifecycleStatus } from '../../common/enums';

export class SectionScheduleTeacherResolutionDto {
  @IsIn(['MOVE', 'DELETE'])
  action!: 'MOVE' | 'DELETE';

  @IsString()
  @IsOptional()
  teacherId?: string;
}

export class UpdateSectionDto {
  @IsEnum(ProgramClassificationStatus)
  @IsOptional()
  programClassificationStatus?: ProgramClassificationStatus;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stageCourseRequirementIds?: string[];
  @IsEnum(SectionLifecycleStatus)
  @IsOptional()
  status?: SectionLifecycleStatus;
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain letters, numbers, underscores, and hyphens' })
  code?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  defaultRoomId?: string;

  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  cohortId?: string;

  @IsString()
  @IsOptional()
  academicCycleId?: string;

  @IsString()
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: 'Color must be a valid hex color like #3B82F6' })
  color?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  teacherIds?: string[];

  @ValidateNested()
  @Type(() => SectionScheduleTeacherResolutionDto)
  @IsOptional()
  scheduleTeacherResolution?: SectionScheduleTeacherResolutionDto;
}
