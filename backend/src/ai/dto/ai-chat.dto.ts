import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class AIChatRequestDto {
  @IsString()
  @MaxLength(12000)
  prompt!: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsBoolean()
  @IsOptional()
  retryLastUserMessage?: boolean;
}

export class UpdateAIConversationDto {
  @IsString()
  @MaxLength(80)
  title!: string;
}
