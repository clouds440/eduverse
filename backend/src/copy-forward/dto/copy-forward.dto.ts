import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, ValidateNested } from 'class-validator';

export class CopyForwardOptionsDto {
  @IsBoolean()
  @IsOptional()
  copySchedules?: boolean;

  @IsBoolean()
  @IsOptional()
  copyAssessments?: boolean;

  @IsBoolean()
  @IsOptional()
  copyMaterials?: boolean;
}

export class CopyForwardDto {
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
  copyAssessments?: boolean;

  @IsBoolean()
  @IsOptional()
  copyMaterials?: boolean;

  @ValidateNested()
  @Type(() => CopyForwardOptionsDto)
  @IsOptional()
  options?: CopyForwardOptionsDto;
}
