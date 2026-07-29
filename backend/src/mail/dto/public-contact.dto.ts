import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class PublicContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  company?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  details?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  honeypot?: string;
}
