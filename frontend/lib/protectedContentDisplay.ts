import { ChatMessageType } from '@/types';
import type { ChatMessage } from '@/types';

type PotentiallyEncrypted = {
    content?: string | null;
    decryptedContent?: string | null;
    encryptionVersion?: number | null;
    encryptedContent?: unknown;
    ciphertext?: unknown;
};

export function isProtectedContent(value?: PotentiallyEncrypted | null) {
    return Boolean(value?.encryptionVersion || value?.encryptedContent || value?.ciphertext);
}

function getReadablePreview(content: string) {
    const withoutImages = content.replace(/!\[.*?\]\(.*?\)/g, '').trim();
    if (withoutImages) return withoutImages;
    if (content.includes('![')) return 'Photo';
    if (content.includes('/files/')) return 'Attachment';
    return content.trim() || 'Sent a message';
}

export function getChatListMessagePreview(message?: Pick<ChatMessage, 'type' | 'deletedAt'> & PotentiallyEncrypted | null) {
    if (!message) return 'Tap to start chatting';
    if (message.deletedAt) return 'Message deleted';
    if (message.type === ChatMessageType.SYSTEM) return 'System update';
    if (message.decryptedContent?.trim()) return getReadablePreview(message.decryptedContent);
    if (isProtectedContent(message)) return 'Encrypted message';
    return getReadablePreview(message.content || '');
}

export function getMailSubjectDisplay(mail?: { subject?: string | null } & PotentiallyEncrypted | null) {
    if (!mail) return 'Loading mail';
    if (isProtectedContent(mail)) return 'Encrypted mail';
    return mail.subject?.trim() || 'Untitled mail';
}
