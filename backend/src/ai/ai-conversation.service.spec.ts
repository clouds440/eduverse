import { compactContextMessages } from './ai-conversation.service';
import type { AIProviderMessage } from './ai.types';

describe('AIConversationService context compaction', () => {
  it('keeps short conversations unchanged', () => {
    const messages: AIProviderMessage[] = [
      { role: 'user', content: 'What are my weakest courses?' },
      { role: 'assistant', content: 'Your weakest course appears to be Algebra.' },
    ];

    expect(compactContextMessages(messages)).toEqual(messages);
  });

  it('summarizes older turns and preserves recent turns', () => {
    const messages: AIProviderMessage[] = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Turn ${index + 1}`,
    }));

    const compacted = compactContextMessages(messages);

    expect(compacted[0]).toMatchObject({
      role: 'system',
    });
    expect(compacted[0].content).toContain('Compact memory from earlier turns');
    expect(compacted.slice(1)).toEqual(messages.slice(-10));
  });

  it('drops blank messages and truncates very large content', () => {
    const compacted = compactContextMessages([
      { role: 'user', content: '   ' },
      { role: 'assistant', content: 'x'.repeat(5000) },
    ]);

    expect(compacted).toHaveLength(1);
    expect(compacted[0].content.length).toBeLessThan(2500);
    expect(compacted[0].content).toContain('[Content truncated]');
  });
});
