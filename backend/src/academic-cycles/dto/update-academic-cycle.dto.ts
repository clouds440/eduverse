import { IsString, IsOptional, IsDateString, Matches, MaxLength } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export class UpdateAcademicCycleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain letters, numbers, underscores, and hyphens' })
  code?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  gpaPolicyId?: string;
}
