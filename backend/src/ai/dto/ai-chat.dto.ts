import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class AIChatMessageDto {
  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(12000)
  content!: string;
}

export class AIChatRequestDto {
  @IsString()
  @MaxLength(12000)
  prompt!: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsArray()
  @IsOptional()
  history?: AIChatMessageDto[];
}
