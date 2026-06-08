import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { GpaCalculationMethod, GpaRounding } from '@prisma/client';

export class GpaGradeRuleDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  min!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  max!: number;

  @IsString()
  @IsNotEmpty()
  letter!: string;

  @IsNumber()
  @Min(0)
  points!: number;
}

export class CreateGpaPolicyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  scale?: number;

  @IsEnum(GpaCalculationMethod)
  @IsOptional()
  method?: GpaCalculationMethod;

  @IsEnum(GpaRounding)
  @IsOptional()
  rounding?: GpaRounding;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpaGradeRuleDto)
  gradeRules!: GpaGradeRuleDto[];

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateGpaPolicyDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  scale?: number;

  @IsEnum(GpaCalculationMethod)
  @IsOptional()
  method?: GpaCalculationMethod;

  @IsEnum(GpaRounding)
  @IsOptional()
  rounding?: GpaRounding;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpaGradeRuleDto)
  @IsOptional()
  gradeRules?: GpaGradeRuleDto[];
}

export class PreviewGpaPolicyDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  marks!: number;

  @IsNumber()
  @Min(0.01)
  creditHours!: number;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  scale?: number;

  @IsEnum(GpaCalculationMethod)
  @IsOptional()
  method?: GpaCalculationMethod;

  @IsEnum(GpaRounding)
  @IsOptional()
  rounding?: GpaRounding;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpaGradeRuleDto)
  gradeRules!: GpaGradeRuleDto[];
}

