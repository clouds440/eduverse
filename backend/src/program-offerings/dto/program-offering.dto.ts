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
  IsNumber,
} from 'class-validator';
import {
  ProgramDurationUnit,
  ProgramOfferingAction,
  ProgramOfferingAttendanceMode,
  ProgramOfferingDeliveryMode,
  ProgramOfferingStatus,
  ProgramStageOfferingStatus,
} from '@/prisma/prisma-client';

export class ProgramOfferingFeeInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  label!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currencyCode!: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  frequency?: string | null;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;

  @IsBoolean()
  @IsOptional()
  isApplicationFee?: boolean;

  @IsBoolean()
  @IsOptional()
  refundable?: boolean | null;
}

export class ProgramOfferingFundingOptionInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1500)
  description?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  fundingType?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(250)
  amountSummary?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  eligibilitySummary?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  applicationUrl?: string | null;
}

export class ProgramAdmissionRequirementInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  label!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1500)
  description?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  requirementType?: string | null;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}

export class CreateProviderLocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  displayLabel!: string;

  @IsString() @IsOptional() @MaxLength(250) addressLine1?: string;
  @IsString() @IsOptional() @MaxLength(250) addressLine2?: string;
  @IsString() @IsOptional() @MaxLength(120) city?: string;
  @IsString() @IsOptional() @MaxLength(120) region?: string;
  @IsString() @IsOptional() @MaxLength(2) countryCode?: string;
  @IsString() @IsOptional() @MaxLength(30) postalCode?: string;
  @IsNumber() @IsOptional() latitude?: number;
  @IsNumber() @IsOptional() longitude?: number;
}

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

export class CampusProgramOfferingBindingInputDto {
  @IsString()
  @IsNotEmpty()
  curriculumVersionId!: string;

  @IsString()
  @IsNotEmpty()
  academicCycleId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramStageOfferingInputDto)
  stages!: ProgramStageOfferingInputDto[];
}

export class CreateProgramOfferingDto {
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  slug?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  intakeName!: string;

  @IsEnum(ProgramOfferingStatus)
  @IsOptional()
  status?: ProgramOfferingStatus;

  @IsDateString()
  @IsOptional()
  applicationOpensAt?: string | null;

  @IsDateString()
  @IsOptional()
  applicationClosesAt?: string | null;

  @IsDateString()
  @IsOptional()
  teachingStartsAt?: string | null;

  @IsDateString()
  @IsOptional()
  teachingEndsAt?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  timezone!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  waitlistEnabled?: boolean;

  @IsEnum(ProgramOfferingDeliveryMode)
  deliveryMode!: ProgramOfferingDeliveryMode;

  @IsEnum(ProgramOfferingAttendanceMode)
  attendanceMode!: ProgramOfferingAttendanceMode;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  scheduleSummary?: string | null;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationValue?: number | null;

  @IsEnum(ProgramDurationUnit)
  @IsOptional()
  durationUnit?: ProgramDurationUnit | null;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  languageCodes?: string[];

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  publicSummary?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  detailedInstructions?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(320)
  contactEmail?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(ProgramOfferingAction, { each: true })
  supportedActions!: ProgramOfferingAction[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  locationIds?: string[];

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
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProgramOfferingFeeInputDto)
  @IsOptional()
  fees?: ProgramOfferingFeeInputDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProgramOfferingFundingOptionInputDto)
  @IsOptional()
  fundingOptions?: ProgramOfferingFundingOptionInputDto[];

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ProgramAdmissionRequirementInputDto)
  @IsOptional()
  admissionRequirements?: ProgramAdmissionRequirementInputDto[];

  @ValidateNested()
  @Type(() => CampusProgramOfferingBindingInputDto)
  campusBinding!: CampusProgramOfferingBindingInputDto;
}

export class UpdateProgramOfferingDto {
  @IsEnum(ProgramOfferingStatus)
  @IsOptional()
  status?: ProgramOfferingStatus;

  @IsDateString()
  @IsOptional()
  applicationOpensAt?: string | null;

  @IsDateString()
  @IsOptional()
  applicationClosesAt?: string | null;

  @IsDateString()
  @IsOptional()
  teachingStartsAt?: string | null;

  @IsDateString()
  @IsOptional()
  teachingEndsAt?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  intakeName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  timezone?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  waitlistEnabled?: boolean;

  @IsEnum(ProgramOfferingDeliveryMode)
  @IsOptional()
  deliveryMode?: ProgramOfferingDeliveryMode;

  @IsEnum(ProgramOfferingAttendanceMode)
  @IsOptional()
  attendanceMode?: ProgramOfferingAttendanceMode;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  scheduleSummary?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  publicSummary?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  detailedInstructions?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(320)
  contactEmail?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(ProgramOfferingAction, { each: true })
  @IsOptional()
  supportedActions?: ProgramOfferingAction[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsOptional()
  locationIds?: string[];

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
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProgramOfferingFeeInputDto)
  @IsOptional()
  fees?: ProgramOfferingFeeInputDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProgramOfferingFundingOptionInputDto)
  @IsOptional()
  fundingOptions?: ProgramOfferingFundingOptionInputDto[];

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ProgramAdmissionRequirementInputDto)
  @IsOptional()
  admissionRequirements?: ProgramAdmissionRequirementInputDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgramStageOfferingInputDto)
  @IsOptional()
  stages?: ProgramStageOfferingInputDto[];
}
