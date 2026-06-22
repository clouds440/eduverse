import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { DepartmentScopeType, HolidayMatchMode, HolidayType, TargetType } from '@/prisma/prisma-client';
import { AnnouncementPriority } from '../../announcements/dto/create-announcement.dto';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsEnum(HolidayType)
  @IsOptional()
  type?: HolidayType;

  @IsEnum(HolidayMatchMode)
  @IsOptional()
  matchMode?: HolidayMatchMode;

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
  @ValidateIf((dto) => dto.matchMode === HolidayMatchMode.WEEKDAYS_IN_RANGE)
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
