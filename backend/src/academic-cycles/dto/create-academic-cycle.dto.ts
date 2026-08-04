import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum, Matches, MaxLength } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';
import { AcademicCycleStatus } from '../../common/enums';

export class CreateAcademicCycleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain letters, numbers, underscores, and hyphens' })
  code: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsEnum(AcademicCycleStatus)
  @IsOptional()
  status?: AcademicCycleStatus.DRAFT | AcademicCycleStatus.ACTIVE;

  @IsString()
  @IsOptional()
  gpaPolicyId?: string;
}
