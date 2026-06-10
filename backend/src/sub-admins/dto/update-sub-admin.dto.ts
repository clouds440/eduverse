import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, Matches, MinLength, ValidateIf } from 'class-validator';
import { CreateSubAdminDto } from './create-sub-admin.dto';

export class UpdateSubAdminDto extends PartialType(CreateSubAdminDto) {
  @IsOptional()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  @ValidateIf((o) => o.password !== '' && o.password !== undefined)
  password?: string;
}
