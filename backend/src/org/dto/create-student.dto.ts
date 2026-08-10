import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  MinLength,
  Matches,
  IsDateString,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';
import { StudentStatus } from '../../common/enums';

export class CreateStudentDto {
  @IsString()
  @IsOptional()
  programId?: string;

  @IsString()
  @IsOptional()
  entryStageId?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  registrationNumber: string;

  @IsString()
  @IsNotEmpty()
  rollNumber: string;

  @IsString()
  @IsOptional()
  fatherName?: string;

  @IsNumber()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  primaryDepartmentId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];

  @IsDateString()
  @IsOptional()
  @ValidateIf((o) => o.admissionDate !== '' && o.admissionDate !== null)
  admissionDate?: string;

  @IsDateString()
  @IsOptional()
  @ValidateIf(
    (o) =>
      o.graduationDate !== '' &&
      o.graduationDate !== null &&
      o.graduationDate !== undefined,
  )
  graduationDate?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;

  @IsString()
  @IsOptional()
  guardianId?: string;

  @IsString()
  @IsOptional()
  guardianRelationship?: string;
}
