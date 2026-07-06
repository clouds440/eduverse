import { ArrayMaxSize, IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AnnouncementPriority } from '../../announcements/dto/create-announcement.dto';
import { PreferenceWindowKind } from '@/prisma/prisma-client';

export class PreferenceWindowDto {
  @IsEnum(PreferenceWindowKind)
  kind!: PreferenceWindowKind;

  @IsString()
  @IsNotEmpty()
  academicCycleId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string | null;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsOptional()
  optionCourseIds?: string[];

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @IsOptional()
  optionSectionIds?: string[];

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsOptional()
  audienceCourseIds?: string[];

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsOptional()
  audienceCohortIds?: string[];

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @IsOptional()
  audienceSectionIds?: string[];

  @IsEnum(AnnouncementPriority)
  @IsOptional()
  announcementPriority?: AnnouncementPriority;
}

export class UpdatePreferenceWindowDto extends PreferenceWindowDto {}

export class PreferenceSubmissionDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  rankedOptionIds!: string[];
}
