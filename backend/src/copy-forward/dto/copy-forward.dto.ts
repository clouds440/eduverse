import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, ValidateNested, ValidateIf } from 'class-validator';
import { ProgramClassificationStatus } from '../../common/enums';

export class CopyForwardOptionsDto {
  @IsBoolean()
  @IsOptional()
  copySchedules?: boolean;

  @IsBoolean()
  @IsOptional()
  copyMaterials?: boolean;
}

export class CopyForwardDto {
  @IsEnum(ProgramClassificationStatus)
  programClassificationStatus: ProgramClassificationStatus;

  @ValidateIf((dto) => dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED)
  @IsString()
  @IsNotEmpty()
  sourceProgramAcademicCycleId?: string;

  @ValidateIf((dto) => dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED)
  @IsString()
  @IsNotEmpty()
  targetProgramAcademicCycleId?: string;

  @ValidateIf((dto) => dto.programClassificationStatus === ProgramClassificationStatus.PROGRAM_MAPPED)
  @IsString()
  @IsNotEmpty()
  targetProgramStageId?: string;

  @IsString()
  @IsNotEmpty()
  fromCycleId: string;

  @IsString()
  @IsNotEmpty()
  toCycleId: string;

  @IsBoolean()
  @IsOptional()
  copySchedules?: boolean;

  @IsBoolean()
  @IsOptional()
  copyMaterials?: boolean;

  @ValidateNested()
  @Type(() => CopyForwardOptionsDto)
  @IsOptional()
  options?: CopyForwardOptionsDto;
}
