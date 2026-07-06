import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

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
}

export class WithdrawEnrollmentDto {
  @IsString()
  studentId!: string;

  @IsString()
  sectionId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
