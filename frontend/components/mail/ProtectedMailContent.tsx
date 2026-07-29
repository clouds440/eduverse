'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { EncryptedMailContent } from '@/types';
import { decryptMailContent } from '@/lib/e2ee';
import { RichMessageRenderer } from '@/components/ui/RichMessageRenderer';

interface ProtectedMailTextProps {
    encryptedContent?: EncryptedMailContent | null;
    fallback: string;
    token?: string | null;
    unavailableText?: string;
    loadingText?: string;
    className?: string;
}

function useProtectedMailContent({
    encryptedContent,
    fallback,
    token,
    unavailableText,
}: Required<Pick<ProtectedMailTextProps, 'fallback' | 'unavailableText'>> &
    Pick<ProtectedMailTextProps, 'encryptedContent' | 'token'>) {
    const encryptedContentKey = encryptedContent?.ciphertext
        ? encryptedContent.id ||
            `${encryptedContent.nonce}:${encryptedContent.ciphertext}`
        : 'plain';
    const [resolved, setResolved] = useState<{
        key: string;
        text: string;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (
            !encryptedContent?.ciphertext ||
            !token ||
            resolved?.key === encryptedContentKey
        ) {
            return;
        }

        decryptMailContent(encryptedContent, fallback, token)
            .then((text) => {
                if (!cancelled) {
                    setResolved({ key: encryptedContentKey, text });
                }
            })
            .catch((error) => {
                console.warn(
                    'Secure Mail content unavailable on this browser',
                    error,
                );
                if (!cancelled) {
                    setResolved({
                        key: encryptedContentKey,
                        text: unavailableText,
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        encryptedContent,
        encryptedContentKey,
        fallback,
        resolved?.key,
        token,
        unavailableText,
    ]);

    if (!encryptedContent?.ciphertext) {
        return { loading: false, text: fallback };
    }
    if (!token) {
        return { loading: false, text: unavailableText };
    }
    if (resolved?.key !== encryptedContentKey) {
        return { loading: true, text: '' };
    }
    return { loading: false, text: resolved.text };
}

export function ProtectedMailText({
    encryptedContent,
    fallback,
    token,
    unavailableText = "This content can't be opened here",
    loadingText = 'Loading mail...',
    className,
}: ProtectedMailTextProps) {
    const { loading, text } = useProtectedMailContent({
        encryptedContent,
        fallback,
        token,
        unavailableText,
    });

    if (loading) {
        return (
            <span className={`inline-flex items-center gap-1.5 ${className || ''}`}>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                {loadingText}
            </span>
        );
    }

    return <span className={className}>{text}</span>;
}

export function ProtectedMailMessage({
    encryptedContent,
    fallback,
    token,
    className,
    attachmentAlign,
    loadingText = 'Loading mail...',
}: ProtectedMailTextProps & { attachmentAlign?: 'left' | 'right' }) {
    const unavailableText = "This message can't be opened here.";
    const { loading, text } = useProtectedMailContent({
        encryptedContent,
        fallback,
        token,
        unavailableText,
    });

    if (loading) {
        return (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{loadingText}</span>
            </div>
        );
    }

    return (
        <RichMessageRenderer
            content={text}
            className={className}
            attachmentAlign={attachmentAlign}
            compactAttachments
        />
    );
}
