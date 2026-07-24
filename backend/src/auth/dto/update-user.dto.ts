import { IsOptional, IsIn, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['LIGHT', 'DARK', 'SYSTEM'])
  themeMode?: 'LIGHT' | 'DARK' | 'SYSTEM';

  @IsOptional()
  @IsString()
  name?: string;
}
