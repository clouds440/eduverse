import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { AssessmentType } from '@/prisma/prisma-client';

export class CreateAssessmentDto {
  @IsString()
  @IsNotEmpty()
  sectionId: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(AssessmentType)
  @IsNotEmpty()
  type: AssessmentType;

  @IsNumber()
  @Min(0)
  totalMarks: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  weightage: number;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsBoolean()
  @IsOptional()
  allowSubmissions?: boolean;

  @IsString()
  @IsOptional()
  externalLink?: string;

  @IsBoolean()
  @IsOptional()
  isVideoLink?: boolean;
}
