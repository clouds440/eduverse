import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { TargetType } from '@/prisma/prisma-client';

export enum AnnouncementPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsEnum(TargetType)
  @IsNotEmpty()
  targetType: TargetType;

  @IsString()
  @IsOptional()
  targetId?: string;

  @IsString()
  @IsOptional()
  actionUrl?: string;

  @IsEnum(AnnouncementPriority)
  @IsOptional()
  priority?: AnnouncementPriority;
}
