import { IsString, IsNotEmpty, IsArray, IsBoolean, IsOptional, Matches, MaxLength } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectionIds?: string[];
}
