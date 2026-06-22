import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export class CreateBuildingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(ENTITY_CODE_PATTERN, { message: 'Code may contain letters, numbers, underscores, and hyphens' })
  code: string;

  @IsString()
  @IsOptional()
  @MaxLength(250)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(250)
  landmark?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  directionsNote?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @IsNumber()
  @IsOptional()
  mapX?: number;

  @IsNumber()
  @IsOptional()
  mapY?: number;

  @IsNumber()
  @IsOptional()
  mapWidth?: number;

  @IsNumber()
  @IsOptional()
  mapHeight?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];
}
