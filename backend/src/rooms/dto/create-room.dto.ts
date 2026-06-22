import { RoomType } from '@/prisma/prisma-client';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Matches, MaxLength } from 'class-validator';
import { ENTITY_CODE_PATTERN } from '../../common/entity-code';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  buildingId: string;

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
  @IsNotEmpty()
  @MaxLength(40)
  floor: string;

  @IsEnum(RoomType)
  @IsOptional()
  type?: RoomType;

  @IsInt()
  @IsPositive()
  @IsOptional()
  capacity?: number;

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
}
