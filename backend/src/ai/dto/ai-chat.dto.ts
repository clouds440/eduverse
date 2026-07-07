import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AIChatRequestDto {
  @IsString()
  @MaxLength(12000)
  prompt!: string;

  @IsString()
  @IsOptional()
  conversationId?: string;
}

export class UpdateAIConversationDto {
  @IsString()
  @MaxLength(80)
  title!: string;
}
