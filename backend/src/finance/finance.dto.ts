import { IsString, IsEnum, IsNumber, IsOptional, IsDateString, IsBoolean, IsObject, Min, IsArray } from 'class-validator';
import { FinanceCategory, BillingCycle, FinanceTargetType, FinanceAssignmentSource } from '@prisma/client';

export class CreateFinancialStructureDto {
  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(FinanceTargetType)
  @IsOptional()
  targetType?: FinanceTargetType;

  @IsString()
  @IsOptional()
  studentId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsEnum(FinanceCategory)
  category: FinanceCategory;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @IsNumber()
  @IsOptional()
  dueDay?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;

  @IsEnum(FinanceAssignmentSource)
  @IsOptional()
  assignmentSource?: FinanceAssignmentSource;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  studentIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  teacherIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectionIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cohortIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  courseIds?: string[];

  @IsString()
  @IsOptional()
  entityName?: string;
}

export class UpdateFinancialStructureDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(FinanceCategory)
  @IsOptional()
  category?: FinanceCategory;

  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: BillingCycle;

  @IsNumber()
  @IsOptional()
  dueDay?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class CreateManualEntryDto {
  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  studentId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class MarkPaidDto {
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  claimedAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentIds?: string[];
}

export class ConfirmEntryDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  paidAmount?: number;

  @IsString()
  @IsOptional()
  claimId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentIds?: string[];
}
