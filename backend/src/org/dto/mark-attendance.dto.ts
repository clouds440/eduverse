import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { AttendanceStatus } from '@/prisma/prisma-client';

export class AttendanceRecordDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
