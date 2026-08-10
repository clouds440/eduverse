import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProgramOfferingStatus, ProgramStageOfferingStatus } from '@/prisma/prisma-client';

export class ProgramStageOfferingInputDto {
  @IsString()
  @IsNotEmpty()
  programStageId!: string;

  @IsEnum(ProgramStageOfferingStatus)
  @IsOptional()
  status?: ProgramStageOfferingStatus;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;
}

export class CreateProgramOfferingDto {
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @IsString()
  @IsNotEmpty()
  curriculumVersionId!: string;

  @IsString()
  @IsNotEmpty()
  academicCycleId!: string;

  @IsEnum(ProgramOfferingStatus)
  @IsOptional()
  status?: ProgramOfferingStatus;

  @IsDateString()
  @IsOptional()
  opensAt?: string | null;

  @IsDateString()
  @IsOptional()
  closesAt?: string | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramStageOfferingInputDto)
  stages!: ProgramStageOfferingInputDto[];
}

export class UpdateProgramOfferingDto {
  @IsEnum(ProgramOfferingStatus)
  @IsOptional()
  status?: ProgramOfferingStatus;

  @IsDateString()
  @IsOptional()
  opensAt?: string | null;

  @IsDateString()
  @IsOptional()
  closesAt?: string | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramStageOfferingInputDto)
  @IsOptional()
  stages?: ProgramStageOfferingInputDto[];
}
