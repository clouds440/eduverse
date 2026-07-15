'use client';

import { useEffect, useMemo, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
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
    const [plaintext, setPlaintext] = useState(message.decryptedContent || (encrypted ? '' : message.content));
    const [status, setStatus] = useState<'decrypting' | 'ready' | 'unavailable'>(
        !encrypted || message.decryptedContent ? 'ready' : 'decrypting',
    );

    useEffect(() => {
        let cancelled = false;

        if (!encrypted) {
            setPlaintext(message.content);
            setStatus('ready');
            return;
        }

        if (message.decryptedContent) {
            setPlaintext(message.decryptedContent);
            setStatus('ready');
            return;
        }

        if (!token) {
            setStatus('unavailable');
            return;
        }

        setStatus('decrypting');
        decryptChatMessageContent(message, token)
            .then((value) => {
                if (cancelled) return;
                setPlaintext(value);
                setStatus('ready');
                onDecrypted?.(message.id, value);
            })
            .catch((error) => {
                if (cancelled) return;
                console.warn('Encrypted chat message unavailable on this device', error);
                setPlaintext('');
                setStatus('unavailable');
            });

        return () => {
            cancelled = true;
        };
    }, [
        encrypted,
        encryptedContentKey,
        message.content,
        message.decryptedContent,
        message.id,
        onDecrypted,
        token,
    ]);

    if (status === 'decrypting') {
        return null;
    }

    if (status === 'unavailable') {
        return (
            <span className={unavailableClassName || 'inline-flex items-center gap-1.5 text-xs font-semibold opacity-75'}>
                <LockKeyhole className="h-3.5 w-3.5" />
                This message can't be opened here
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
