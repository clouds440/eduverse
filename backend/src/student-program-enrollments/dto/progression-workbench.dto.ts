import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

export enum BulkProgressionAction {
  ADVANCE = 'ADVANCE',
  SKIP = 'SKIP',
  REPEAT = 'REPEAT',
  PAUSE = 'PAUSE',
  TRANSFER = 'TRANSFER',
  COMPLETE_PROGRAM = 'COMPLETE_PROGRAM',
}

export class ProgressionWorkbenchPreviewDto {
  @IsString()
  @IsNotEmpty()
  programStageOfferingId!: string;

  @IsString()
  @IsOptional()
  cohortOfferingId?: string;
}

export class BulkProgressionItemDto {
  @IsString()
  @IsNotEmpty()
  stageEnrollmentId!: string;

  @IsEnum(BulkProgressionAction)
  action!: BulkProgressionAction;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  overrideReason?: string;

  @IsString()
  @IsOptional()
  targetProgramStageOfferingId?: string;

  @IsString()
  @IsOptional()
  cohortOfferingId?: string;

  @IsString()
  @IsOptional()
  targetProgramId?: string;

  @IsString()
  @IsOptional()
  entryStageId?: string;
}

export class ApplyBulkProgressionDto extends ProgressionWorkbenchPreviewDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkProgressionItemDto)
  items!: BulkProgressionItemDto[];
}
