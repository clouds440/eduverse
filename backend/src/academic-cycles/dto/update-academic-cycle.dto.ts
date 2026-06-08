import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class UpdateAcademicCycleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  gpaPolicyId?: string;
}
