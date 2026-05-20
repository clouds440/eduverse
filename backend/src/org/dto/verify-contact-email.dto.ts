import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyContactEmailDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Verification code must be 6 digits' })
  code!: string;
}
