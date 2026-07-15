import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTrustedDeviceDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  displayName?: string;
}
