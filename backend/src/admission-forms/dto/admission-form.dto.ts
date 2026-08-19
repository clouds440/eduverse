import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class AdmissionDocumentRequirementDto {
  @IsString() @IsNotEmpty() @MaxLength(64) key!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) label!: string;
  @IsString() @IsOptional() @MaxLength(1000) description?: string;
  @IsString() @IsOptional() @MaxLength(80) category?: string;
  @IsBoolean() @IsOptional() isRequired?: boolean;
  @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @IsOptional() acceptedMimeTypes?: string[];
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @IsOptional() acceptedExtensions?: string[];
  @IsInt() @Min(1) @Max(50 * 1024 * 1024) @IsOptional() maxFileSizeBytes?: number;
  @IsInt() @Min(1) @Max(10) @IsOptional() maxFileCount?: number;
  @IsBoolean() @IsOptional() requiresExpiryDate?: boolean;
}

export class CreateAdmissionFormDto {
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsString() @IsOptional() @MaxLength(1000) description?: string;
  @IsObject() definition!: Record<string, unknown>;
  @IsObject() @IsOptional() uiSchema?: Record<string, unknown>;
  @IsString() @IsOptional() @MaxLength(10000) consentText?: string;
  @IsString() @IsOptional() @MaxLength(80) consentVersion?: string;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => AdmissionDocumentRequirementDto)
  documentRequirements!: AdmissionDocumentRequirementDto[];
}

export class UpdateAdmissionFormVersionDto {
  @IsObject() definition!: Record<string, unknown>;
  @IsObject() @IsOptional() uiSchema?: Record<string, unknown>;
  @IsString() @IsOptional() @MaxLength(10000) consentText?: string;
  @IsString() @IsOptional() @MaxLength(80) consentVersion?: string;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => AdmissionDocumentRequirementDto)
  documentRequirements!: AdmissionDocumentRequirementDto[];
}

export class BindOfferingApplicationFormDto {
  @IsString() @IsNotEmpty() applicationVersionId!: string;
  @IsBoolean() @IsOptional() onlineAdmissionEnabled?: boolean;
  @IsString() @IsOptional() @MaxLength(5000) onlineAdmissionInstructions?: string;
  @IsBoolean() @IsOptional() allowApplicantUpdates?: boolean;
  @IsBoolean() @IsOptional() requireEmailVerification?: boolean;
}
