import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../../common/enums';
import { DepartmentScopeType } from '../../common/enums';

export class CreateSubAdminDto {
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

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsEnum(DepartmentScopeType)
  @IsOptional()
  departmentScopeType?: DepartmentScopeType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departmentIds?: string[];
}
