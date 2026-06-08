import { IsNumber, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
