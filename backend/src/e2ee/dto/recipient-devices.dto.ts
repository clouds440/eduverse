import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class RecipientDevicesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  userIds!: string[];
}
