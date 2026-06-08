import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  creditHours?: number;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}
