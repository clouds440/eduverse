import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export type AttendanceTransferMode = 'PRESERVE_ONLY' | 'PERCENTAGE_ADJUSTMENT';

export class EnrollStudentDto {
  @IsString()
  studentId!: string;

  @IsString()
  sectionId!: string;
}

export class BulkEnrollStudentsDto {
  @IsString()
  sectionId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  studentIds!: string[];
}

export class TransferEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  fromSectionId!: string;

  @IsString()
  toSectionId!: string;

  @IsBoolean()
  @IsOptional()
  wasExcluded?: boolean;

  @IsIn(['PRESERVE_ONLY', 'PERCENTAGE_ADJUSTMENT'])
  @IsOptional()
  attendanceTransferMode?: AttendanceTransferMode;

  @IsString()
  @IsOptional()
  transferDate?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class WithdrawEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  sectionId!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  wasExcluded?: boolean;
}
