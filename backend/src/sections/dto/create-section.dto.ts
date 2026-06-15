import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { HEX_COLOR_PATTERN } from '../section-colors';

export class CreateSectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @IsString()
  @IsOptional()
  cohortId?: string;

  @IsString()
  @IsOptional()
  @Matches(HEX_COLOR_PATTERN, { message: 'Color must be a valid hex color like #3B82F6' })
  color?: string;
}
