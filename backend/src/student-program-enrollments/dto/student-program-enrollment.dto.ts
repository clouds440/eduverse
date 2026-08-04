import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class AdmitStudentProgramDto {
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @IsString()
  @IsOptional()
  entryAcademicCycleId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  entryStageSequence?: number;
}

export class TransferStudentProgramDto extends AdmitStudentProgramDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ProgramEnrollmentReasonDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class WithdrawStudentProgramDto extends ProgramEnrollmentReasonDto {
  @IsBoolean()
  @IsOptional()
  retainPrimaryDepartment?: boolean;

  @IsString()
  @IsOptional()
  replacementPrimaryDepartmentId?: string;
}

export class ActivateProgramCycleDto {
  @IsString()
  @IsNotEmpty()
  studentProgramEnrollmentCycleId!: string;

  @IsString()
  @IsOptional()
  cohortId?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ResolveProgramCycleDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsObject()
  @IsOptional()
  resultSnapshot?: Record<string, unknown>;
}

export class RepeatProgramCycleDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  cohortId?: string;
}
