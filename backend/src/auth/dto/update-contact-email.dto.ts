import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class UpdateContactEmailDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'A valid contact email is required' })
  contactEmail!: string;
}
