import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AISubscriptionOwnerType, AISubscriptionPlan, Role } from '@/prisma/prisma-client';

export class UpdateAISubscriptionDto {
  @IsEnum(AISubscriptionPlan)
  plan!: AISubscriptionPlan;
}

export class CreateAIBillingCheckoutDto {
  @IsEnum(AISubscriptionPlan)
  plan!: AISubscriptionPlan;
}

export class CreateAIBillingPortalDto {
  @IsEnum(AISubscriptionOwnerType)
  ownerType!: AISubscriptionOwnerType;

  @IsString()
  @IsOptional()
  returnPath?: string;
}

export class UpdateAIOrgAccessPolicyDto {
  @IsBoolean()
  @IsOptional()
  allowSubAdmins?: boolean;

  @IsBoolean()
  @IsOptional()
  allowManagers?: boolean;

  @IsBoolean()
  @IsOptional()
  allowFinanceManagers?: boolean;

  @IsBoolean()
  @IsOptional()
  allowTeachers?: boolean;

  @IsBoolean()
  @IsOptional()
  allowStudents?: boolean;

  @IsBoolean()
  @IsOptional()
  allowGuardians?: boolean;
}

export class UpdateAIRoleCreditPolicyDto {
  @IsEnum(Role)
  role!: Role;

  @IsInt()
  @Min(0)
  monthlyCredits!: number;
}
