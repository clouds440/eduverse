'use client';

import React, { useMemo } from 'react';
import { getPublicUrl } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { AttachmentPreviewCard, getAttachmentPreviewKind, type AttachmentPreviewKind } from './AttachmentPreviewCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface RichMessageRendererProps {
    content: string;
    className?: string;
    attachmentAlign?: 'left' | 'right';
    compactAttachments?: boolean;
    attachmentsFirst?: boolean;
}

type ExtractedAttachment = {
    fileName: string;
    href: string;
    kind: AttachmentPreviewKind;
};

const ATTACHMENT_LABEL_REGEX = /^(?:[^\w\s()[\]:.-]+\s*)?(PDF:|DOC:|Doc:|XLS:|PPT:|ARCHIVE:|ZIP:|Attachment:)\s*(.*)/i;

function extractDocumentAttachments(content: string): { attachments: ExtractedAttachment[]; cleanedContent: string } {
    const extracted: ExtractedAttachment[] = [];
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let finalCleanedContent = content || '';
    let match: RegExpExecArray | null;
    const matchesToReplace: string[] = [];

    markdownLinkRegex.lastIndex = 0;

    while ((match = markdownLinkRegex.exec(content || '')) !== null) {
        const fullLinkMarkdown = match[0];
        const text = match[1];
        const href = match[2];
        const docMatch = text.match(ATTACHMENT_LABEL_REGEX);

        if (!docMatch) continue;

        const type = docMatch[1];
        const fileName = docMatch[2].trim();
        const resolved = href && /^(blob:|https?:)/i.test(href) ? href : href ? getPublicUrl(href) : '';
        const safeUrl = normalizeSafeUrl(resolved, { allowRelative: true });

        if (safeUrl) {
            extracted.push({
                fileName,
                href: safeUrl,
                kind: getAttachmentPreviewKind(type, fileName)
            });
            matchesToReplace.push(fullLinkMarkdown);
        }
    }

    matchesToReplace.forEach((markdownLink) => {
        finalCleanedContent = finalCleanedContent.replace(markdownLink, '');
    });

    return { attachments: extracted, cleanedContent: finalCleanedContent.trim() };
}

export const RichMessageRenderer = React.memo(function RichMessageRenderer({
    content,
    className = '',
    attachmentAlign = 'left',
    compactAttachments = false,
    attachmentsFirst = false,
}: RichMessageRendererProps) {
    const { attachments, cleanedContent } = useMemo(() => extractDocumentAttachments(content), [content]);

    const renderedAttachmentCards = attachments.length > 0 ? (
        <div
            className={`markdown-attachments flex flex-col gap-1 ${attachmentAlign === 'right' ? 'items-end' : 'items-start'} w-full ${attachmentsFirst ? 'mt-0.5 mb-0' : 'mt-1'}`}
            style={{ ['--markdown-edge-offset' as string]: '0.5rem' }}
        >
            {attachments.map((attachment, index) => (
                <AttachmentPreviewCard
                    key={`${attachment.href}-${index}`}
                    fileName={attachment.fileName}
                    href={attachment.href}
                    kind={attachment.kind}
                    align={attachmentAlign}
                    compact={compactAttachments}
                />
            ))}
        </div>
    ) : null;

    return (
        <div className={`markdown-renderer flex flex-col w-full ${attachmentsFirst ? 'markdown-renderer-attachments-first' : ''}`}>
            {attachmentsFirst && renderedAttachmentCards}
            {cleanedContent && <MarkdownRenderer content={cleanedContent} className={className} />}
            {!attachmentsFirst && renderedAttachmentCards}
        </div>
    );
}, (prev, next) => (
    prev.content === next.content &&
    prev.className === next.className &&
    prev.attachmentAlign === next.attachmentAlign &&
    prev.compactAttachments === next.compactAttachments &&
    prev.attachmentsFirst === next.attachmentsFirst
));
