'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { decryptChatMessageContent, isEncryptedChatMessage } from '@/lib/e2ee';
import type { ChatMessage } from '@/types';
import { RichMessageRenderer } from '../ui/RichMessageRenderer';

interface ProtectedChatMessageContentProps {
    message: ChatMessage & { decryptedContent?: string };
    className?: string;
    attachmentAlign?: 'left' | 'right';
    attachmentsFirst?: boolean;
    compactAttachments?: boolean;
    unavailableClassName?: string;
    onDecrypted?: (messageId: string, plaintext: string) => void;
}

export function ProtectedChatMessageContent({
    message,
    className,
    attachmentAlign,
    attachmentsFirst,
    compactAttachments,
    unavailableClassName,
    onDecrypted,
}: ProtectedChatMessageContentProps) {
    const { token } = useAuth();
    const encrypted = isEncryptedChatMessage(message);
    const encryptedContentKey = useMemo(
        () => message.encryptedContent
            ? `${message.id}:${message.updatedAt}:${message.encryptedContent.id || message.encryptedContent.ciphertext}`
            : `${message.id}:${message.updatedAt}:plain`,
        [message.encryptedContent, message.id, message.updatedAt],
    );
    const [decryption, setDecryption] = useState<{
        key: string;
        status: 'ready' | 'unavailable';
        plaintext: string;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (
            !encrypted ||
            message.decryptedContent ||
            !token ||
            decryption?.key === encryptedContentKey
        ) {
            return;
        }

        decryptChatMessageContent(message, token)
            .then((value) => {
                if (cancelled) return;
                setDecryption({
                    key: encryptedContentKey,
                    status: 'ready',
                    plaintext: value,
                });
                onDecrypted?.(message.id, value);
            })
            .catch((error) => {
                if (cancelled) return;
                console.warn('Encrypted chat message unavailable on this device', error);
                setDecryption({
                    key: encryptedContentKey,
                    status: 'unavailable',
                    plaintext: '',
                });
            });

        return () => {
            cancelled = true;
        };
    }, [
        encrypted,
        encryptedContentKey,
        decryption?.key,
        message,
        onDecrypted,
        token,
    ]);

    const status = !encrypted || message.decryptedContent
        ? 'ready'
        : !token
            ? 'unavailable'
            : decryption?.key === encryptedContentKey
                ? decryption.status
                : 'decrypting';
    const plaintext = message.decryptedContent ||
        (!encrypted ? message.content : decryption?.key === encryptedContentKey
            ? decryption.plaintext
            : '');

    if (status === 'decrypting') {
        return (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold opacity-75">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading chat...
            </span>
        );
    }

    if (status === 'unavailable') {
        return (
            <span className={unavailableClassName || 'inline-flex items-center gap-1.5 text-xs font-semibold opacity-75'}>
                <LockKeyhole className="h-3.5 w-3.5" />
                Older messages are not available on this device.
            </span>
        );
    }

    return (
        <RichMessageRenderer
            content={plaintext}
            className={className}
            attachmentAlign={attachmentAlign}
            attachmentsFirst={attachmentsFirst}
            compactAttachments={compactAttachments}
        />
    );
}
