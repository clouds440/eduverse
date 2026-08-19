import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FileUploadDto {
  @IsOptional()
  @IsString()
  orgId?: string | null;

  @IsNotEmpty()
  @IsString()
  entityType: string;

  @IsNotEmpty()
  @IsString()
  entityId: string;

}
