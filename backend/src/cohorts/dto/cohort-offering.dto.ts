import { IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { CohortOfferingStatus, CohortSectionSource } from '@/prisma/prisma-client';

export class CreateCohortOfferingDto {
  @IsString()
  @IsNotEmpty()
  academicCycleId!: string;

  @IsString()
  @IsOptional()
  programStageOfferingId?: string;

  @IsEnum(CohortOfferingStatus)
  @IsOptional()
  status?: CohortOfferingStatus;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectionIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentIds?: string[];
}

export class AssignCohortSectionDto {
  @IsString()
  @IsNotEmpty()
  sectionId!: string;

  @IsEnum(CohortSectionSource)
  @IsOptional()
  source?: CohortSectionSource;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class PreviewCohortOfferingDto extends CreateCohortOfferingDto {}

export class PreviewAssignCohortSectionDto extends AssignCohortSectionDto {}

export class UpdateCohortOfferingDto {
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  programStageOfferingId?: string | null;

  @IsEnum(CohortOfferingStatus)
  @IsOptional()
  status?: CohortOfferingStatus;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;
}
