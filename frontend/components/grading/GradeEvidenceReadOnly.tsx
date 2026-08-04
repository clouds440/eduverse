'use client';

import { Paperclip } from 'lucide-react';
import type { GradeAnswerbookAttachment } from '@/types';
import { getPublicUrl } from '@/lib/utils';
import { AttachmentPreviewCard, getAttachmentPreviewKind } from '@/components/ui/AttachmentPreviewCard';

type GradeEvidenceReadOnlyProps = {
    referenceNumber?: string | null;
    attachments?: GradeAnswerbookAttachment[];
};

export function GradeEvidenceReadOnly({ referenceNumber, attachments = [] }: GradeEvidenceReadOnlyProps) {
    if (!referenceNumber && attachments.length === 0) return null;

    return (
        <div className="space-y-3 border-t border-border/60 pt-3">
            {referenceNumber && (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                    <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-semibold text-muted-foreground">Answerbook reference</span>
                    <span className="min-w-0 truncate font-black text-foreground">{referenceNumber}</span>
                </div>
            )}
            {attachments.length > 0 && (
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {attachments.map((attachment) => (
                        <AttachmentPreviewCard
                            key={attachment.id}
                            fileName={attachment.file.filename}
                            href={getPublicUrl(attachment.file.path)}
                            kind={getAttachmentPreviewKind(attachment.file.mimeType, attachment.file.filename)}
                            fileSize={attachment.file.size}
                            compact
                            compactDownload
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
