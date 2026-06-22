import { IsNumber, IsOptional, IsString, IsNotEmpty, Matches, MaxLength, Min } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain uppercase letters, numbers, underscores, and hyphens' })
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  creditHours?: number;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  updatedBy?: string;
}
