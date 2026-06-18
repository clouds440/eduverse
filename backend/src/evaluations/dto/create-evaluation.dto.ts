import { EvaluationType } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateEvaluationDto {
  @IsEnum(EvaluationType)
  type: EvaluationType;

  @IsString()
  @IsNotEmpty()
  sectionId: string;

  @ValidateIf((dto) => dto.type === EvaluationType.TEACHER)
  @IsString()
  @IsNotEmpty()
  teacherId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(1200)
  feedback?: string;
}
