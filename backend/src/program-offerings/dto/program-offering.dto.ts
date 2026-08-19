import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
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

  @IsBoolean()
  @IsOptional()
  onlineAdmissionEnabled?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  onlineAdmissionInstructions?: string | null;

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

  @IsBoolean()
  @IsOptional()
  onlineAdmissionEnabled?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  onlineAdmissionInstructions?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramStageOfferingInputDto)
  @IsOptional()
  stages?: ProgramStageOfferingInputDto[];
}

export class OnlineAdmissionDocumentRequirementInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  label!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string | null;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  acceptedMimeTypes?: string[];

  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024)
  @IsOptional()
  maxFileSizeBytes?: number | null;
}

export class ReplaceOnlineAdmissionDocumentRequirementsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OnlineAdmissionDocumentRequirementInputDto)
  requirements!: OnlineAdmissionDocumentRequirementInputDto[];
}
