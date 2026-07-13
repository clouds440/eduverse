'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { ChatMentionOptions } from '@/types';

type ChatMentionOptionsKey = readonly ['chat-mention-options', string, string];

export function useChatMentionOptions(chatId: string | null | undefined, token: string | null | undefined, enabled: boolean) {
    const key: ChatMentionOptionsKey | null = enabled && chatId && token
        ? ['chat-mention-options', chatId, token] as const
        : null;

    return useSWR<ChatMentionOptions>(
        key,
        ([, id, authToken]: ChatMentionOptionsKey) => api.chat.getMentionOptions(id, authToken),
        {
            dedupingInterval: 30_000,
            revalidateOnFocus: false,
            keepPreviousData: true,
        },
    );
}
