import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { CourseResultComponentType } from '@/prisma/prisma-client';

export class CourseResultComponentInputDto {
  @IsEnum(CourseResultComponentType)
  componentType!: CourseResultComponentType;

  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @IsString({ each: true })
  sectionIds!: string[];
}

export class UpsertCourseResultSchemeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseResultComponentInputDto)
  @IsNotEmpty()
  components!: CourseResultComponentInputDto[];

  @IsOptional()
  syncEnrollments?: boolean;
}
