import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CohortLifecycleStatus } from '@/prisma/prisma-client';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export class UpdateCohortDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  code?: string;

  @IsEnum(CohortLifecycleStatus)
  @IsOptional()
  status?: CohortLifecycleStatus;
}
