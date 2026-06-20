import {
  IsString,
  IsOptional,
  IsEmail,
  IsObject,
  ValidateNested,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SUPPORTED_ORG_CURRENCIES = ['PKR', 'USD', 'GBP', 'INR', 'EUR', 'SAR', 'AED'] as const;

class AccentColorDto {
  @IsString()
  @IsOptional()
  primary?: string;

  @IsString()
  @IsOptional()
  secondary?: string;
}

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Location is required' })
  location: string;

  @IsEmail({}, { message: 'A valid contact email is required' })
  @IsNotEmpty({ message: 'Contact email is required' })
  contactEmail: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;

  @IsString()
  @IsIn(SUPPORTED_ORG_CURRENCIES, { message: 'Choose a supported currency' })
  @IsOptional()
  currency?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AccentColorDto)
  accentColor?: { primary?: string; secondary?: string };
}
