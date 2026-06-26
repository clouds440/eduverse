import { ScheduleType } from '@/prisma/prisma-client';
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class CreateScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  day?: number;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsEnum(ScheduleType)
  @IsOptional()
  type?: ScheduleType;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  roomId?: string;
}
