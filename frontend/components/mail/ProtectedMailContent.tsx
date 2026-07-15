'use client';

import { useEffect, useState } from 'react';
import type { EncryptedMailContent } from '@/types';
import { decryptMailContent } from '@/lib/e2ee';
import { RichMessageRenderer } from '@/components/ui/RichMessageRenderer';

interface ProtectedMailTextProps {
    encryptedContent?: EncryptedMailContent | null;
    fallback: string;
    token?: string | null;
    unavailableText?: string;
    className?: string;
}

export function ProtectedMailText({
    encryptedContent,
    fallback,
    token,
    unavailableText = "This content can't be opened here",
    className,
}: ProtectedMailTextProps) {
    const [text, setText] = useState(encryptedContent?.ciphertext ? unavailableText : fallback);

    useEffect(() => {
        let cancelled = false;

        if (!encryptedContent?.ciphertext || !token) {
            setText(encryptedContent?.ciphertext ? unavailableText : fallback);
            return;
        }

        decryptMailContent(encryptedContent, fallback, token)
            .then((value) => {
                if (!cancelled) setText(value);
            })
            .catch((error) => {
                console.warn('Secure Mail content unavailable on this browser', error);
                if (!cancelled) setText(unavailableText);
            });

        return () => {
            cancelled = true;
        };
    }, [encryptedContent, fallback, token, unavailableText]);

    return <span className={className}>{text}</span>;
}

export function ProtectedMailMessage({
    encryptedContent,
    fallback,
    token,
    className,
    attachmentAlign,
}: ProtectedMailTextProps & { attachmentAlign?: 'left' | 'right' }) {
    const unavailableText = "This message can't be opened here.";
    const [text, setText] = useState(encryptedContent?.ciphertext ? '' : fallback);

    useEffect(() => {
        let cancelled = false;

        if (!encryptedContent?.ciphertext || !token) {
            setText(encryptedContent?.ciphertext ? unavailableText : fallback);
            return;
        }

        setText('');
        decryptMailContent(encryptedContent, fallback, token)
            .then((value) => {
                if (!cancelled) setText(value);
            })
            .catch((error) => {
                console.warn('Secure Mail message unavailable on this browser', error);
                if (!cancelled) setText(unavailableText);
            });

        return () => {
            cancelled = true;
        };
    }, [encryptedContent, fallback, token]);

    return (
        <RichMessageRenderer
            content={text}
            className={className}
            attachmentAlign={attachmentAlign}
            compactAttachments
        />
    );
}
