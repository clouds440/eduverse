import { IsString, IsNotEmpty, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class CreateAcademicCycleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  gpaPolicyId?: string;
}
