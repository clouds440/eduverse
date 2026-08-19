import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OnlineAdmissionSubmissionStatus } from '@/prisma/prisma-client';

export class CreateOnlineAdmissionSubmissionDto {
  @IsEmail()
  @IsNotEmpty()
  applicantEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  applicantName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  applicantPhone?: string;

  @IsObject()
  formData!: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  challengeId?: string;

  @IsString()
  @IsNotEmpty()
  challengeAnswer?: string;
}

export class UpdateOnlineAdmissionSubmissionStatusDto {
  @IsEnum(OnlineAdmissionSubmissionStatus)
  status!: OnlineAdmissionSubmissionStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}

export class MarkOnlineAdmissionAdmittedDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
