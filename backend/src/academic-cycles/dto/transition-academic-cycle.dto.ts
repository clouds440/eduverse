import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AcademicCycleStatus } from '../../common/enums';

export class TransitionAcademicCycleDto {
  @IsEnum(AcademicCycleStatus)
  status!: AcademicCycleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
