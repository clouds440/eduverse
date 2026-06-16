'use client';

import { ExternalLink, Paperclip } from 'lucide-react';
import { FinanceAttachment } from '@/types';
import { getPublicUrl } from '@/lib/utils';

interface FinanceAttachmentsProps {
    attachments?: FinanceAttachment[];
    compact?: boolean;
}

function uploaderLabel(attachment: FinanceAttachment) {
    return attachment.uploadedBy?.name || attachment.uploadedBy?.email || 'Unknown uploader';
}

export function FinanceAttachments({ attachments = [], compact = false }: FinanceAttachmentsProps) {
    if (!attachments.length) {
        return compact ? null : <p className="text-xs font-semibold text-muted-foreground">No attachments</p>;
    }

    return (
        <div className={`grid gap-2 ${compact ? '' : 'mt-2'}`}>
            {attachments.map((attachment) => (
                <a
                    key={attachment.id}
                    href={getPublicUrl(attachment.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/70 px-2.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground"
                >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
                    {!compact && <span className="hidden shrink-0 sm:inline">by {uploaderLabel(attachment)}</span>}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                </a>
            ))}
        </div>
    );
}
