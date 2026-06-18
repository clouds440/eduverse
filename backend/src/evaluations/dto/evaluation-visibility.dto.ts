import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class EvaluationVisibilityDto {
  @IsBoolean()
  isHidden: boolean;

  @ValidateIf((dto) => dto.isHidden === true)
  @IsString()
  @IsOptional()
  @MaxLength(500)
  hiddenReason?: string;
}
