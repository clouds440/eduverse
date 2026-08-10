import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CohortLifecycleStatus } from '@/prisma/prisma-client';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export class CreateCohortDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN)
  code!: string;

  @IsEnum(CohortLifecycleStatus)
  @IsOptional()
  status?: CohortLifecycleStatus;
}
