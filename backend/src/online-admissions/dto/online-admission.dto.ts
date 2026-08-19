import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OnlineAdmissionSubmissionStatus, ProgramOfferingAction } from '@/prisma/prisma-client';

export class CreateOnlineAdmissionSubmissionDto {
  @IsObject()
  answers!: Record<string, unknown>;

  @IsEnum(ProgramOfferingAction)
  @IsOptional()
  intent?: ProgramOfferingAction;

  @IsObject()
  @IsOptional()
  documentExpiryDates?: Record<string, string>;

  @IsBoolean()
  @IsOptional()
  consentAccepted?: boolean;

  @IsString()
  @IsNotEmpty()
  captchaToken!: string;
}

export class CreateAdditionalDocumentRequestDto {
  @IsString() @IsNotEmpty() @MaxLength(64) key!: string;
  @IsString() @IsNotEmpty() @MaxLength(160) label!: string;
  @IsString() @IsOptional() @MaxLength(1000) description?: string;
  @IsString() @IsOptional() @MaxLength(80) category?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() acceptedMimeTypes?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() acceptedExtensions?: string[];
  @IsInt() @Min(1) @Max(100 * 1024 * 1024) @IsOptional() maxFileSizeBytes?: number;
  @IsInt() @Min(1) @Max(20) @IsOptional() maxFileCount?: number;
  @IsBoolean() @IsOptional() requiresExpiryDate?: boolean;
  @IsDateString() @IsOptional() dueAt?: string;
}

export class UpdateOnlineAdmissionSubmissionStatusDto {
  @IsEnum(OnlineAdmissionSubmissionStatus)
  status!: OnlineAdmissionSubmissionStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}

export class MarkOnlineAdmissionAdmittedDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
