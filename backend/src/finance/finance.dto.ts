import { IsString, IsEnum, IsNumber, IsOptional, IsDateString, IsBoolean, IsObject, Min } from 'class-validator';
import { FinanceCategory, BillingCycle } from '@prisma/client';

export class CreateFinancialStructureDto {
  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

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
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class ConfirmEntryDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  paidAmount?: number;
}
