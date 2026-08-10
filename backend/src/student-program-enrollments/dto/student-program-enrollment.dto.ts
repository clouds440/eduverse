import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class AdmitStudentProgramDto {
  @IsString()
  @IsNotEmpty()
  programId!: string;

  @IsString()
  @IsOptional()
  entryStageId?: string;
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

export class ActivateProgramStageDto {
  @IsString()
  @IsNotEmpty()
  programStageOfferingId!: string;

  @IsString()
  @IsOptional()
  cohortOfferingId?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ResolveProgramStageDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsObject()
  @IsOptional()
  resultSnapshot?: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  overrideReason?: string;
}

export class AdvanceProgramStageDto extends ResolveProgramStageDto {
  @IsString()
  @IsNotEmpty()
  targetProgramStageOfferingId!: string;

  @IsString()
  @IsOptional()
  cohortOfferingId?: string;
}

export class RepeatProgramStageDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  targetProgramStageOfferingId?: string;

  @IsString()
  @IsOptional()
  cohortOfferingId?: string;
}
