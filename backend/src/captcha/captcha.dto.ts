import { ArrayMaxSize, IsArray, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class RedeemCaptchaDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  solutions!: number[];
}
