import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { DepartmentScopeType, AcademicEventMatchMode, AcademicEventType, TargetType } from '@/prisma/prisma-client';
import { AnnouncementPriority } from '../../announcements/dto/create-announcement.dto';

export class CreateAcademicEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  bannerFileId?: string;

  @IsString()
  @IsOptional()
  bannerUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  bannerFilename?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  bannerMimeType?: string;

  @IsEnum(AcademicEventType)
  @IsOptional()
  type?: AcademicEventType;

  @IsEnum(AcademicEventMatchMode)
  @IsOptional()
  matchMode?: AcademicEventMatchMode;

  @IsEnum(DepartmentScopeType)
  @IsOptional()
  departmentScopeType?: DepartmentScopeType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isFullDay?: boolean;

  @ValidateIf((dto) => dto.isFullDay === false)
  @IsString()
  @IsNotEmpty()
  startTime?: string;

  @ValidateIf((dto) => dto.isFullDay === false)
  @IsString()
  @IsNotEmpty()
  endTime?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ValidateIf((dto) => dto.matchMode === AcademicEventMatchMode.WEEKDAYS_IN_RANGE)
  daysOfWeek?: number[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  announce?: boolean;

  @IsEnum(TargetType)
  @IsOptional()
  announcementTargetType?: TargetType;

  @IsString()
  @IsOptional()
  announcementTargetId?: string;

  @IsEnum(AnnouncementPriority)
  @IsOptional()
  announcementPriority?: AnnouncementPriority;
}
