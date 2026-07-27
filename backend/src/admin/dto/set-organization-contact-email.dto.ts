import { IsEmail } from 'class-validator';

export class SetOrganizationContactEmailDto {
  @IsEmail()
  contactEmail!: string;
}
