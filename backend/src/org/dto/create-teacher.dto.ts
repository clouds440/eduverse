import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsBoolean,
  Matches,
  IsDateString,
  IsArray,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { DepartmentScopeType, TeacherStatus } from '../../common/enums';

export class CreateTeacherDto {
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
  name: string; // Used for general info if needed by user schema

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  education: string;

  @IsString()
  @IsNotEmpty()
  designation: string;

  @IsBoolean()
  @IsOptional()
  isManager?: boolean;

  @IsString()
  @IsOptional()
  department?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];

  @IsEnum(DepartmentScopeType)
  @IsOptional()
  departmentScopeType?: DepartmentScopeType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopeDepartmentIds?: string[];

  @IsDateString()
  @IsOptional()
  @ValidateIf((o) => o.joiningDate !== '' && o.joiningDate !== null)
  joiningDate?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectionIds?: string[];

  @IsEnum(TeacherStatus)
  @IsOptional()
  status?: TeacherStatus;
}
