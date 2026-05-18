'use client';

import React, { useState, useEffect } from 'react';
import { Archive, Download, File, FileSpreadsheet, FileText, Paperclip, Presentation, CheckCircle, Loader2 } from 'lucide-react';
import { getFileTypeInfo } from '../chat/chatLayoutHelpers';
import { downloadFile, formatBytes } from '@/lib/utils';

export type AttachmentPreviewKind = 'pdf' | 'doc' | 'sheet' | 'presentation' | 'archive' | 'attachment';

type AttachmentPreviewCardProps = {
    fileName: string;
    href: string;
    kind: AttachmentPreviewKind;
    align?: 'left' | 'right';
    fileSize?: number;
};

const MIME_BY_KIND: Record<AttachmentPreviewKind, string> = {
    pdf: 'application/pdf',
    doc: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    presentation: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    archive: 'application/zip',
    attachment: 'application/octet-stream',
};

const ICON_BY_KIND: Record<AttachmentPreviewKind, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
    pdf: FileText,
    doc: FileText,
    sheet: FileSpreadsheet,
    presentation: Presentation,
    archive: Archive,
    attachment: Paperclip,
};

const EXTENSION_BY_KIND: Record<AttachmentPreviewKind, string> = {
    pdf: '.pdf',
    doc: '.docx',
    sheet: '.xlsx',
    presentation: '.pptx',
    archive: '.zip',
    attachment: '',
};

function getDownloadFileName(fileName: string, kind: AttachmentPreviewKind) {
    const trimmed = fileName.trim() || 'attachment';
    if (/\.[a-z0-9]{1,10}$/i.test(trimmed)) return trimmed;
    return `${trimmed}${EXTENSION_BY_KIND[kind]}`;
}

export function getAttachmentPreviewKind(label: string, fileName = ''): AttachmentPreviewKind {
    const lowerName = fileName.toLowerCase();
    if (/\.(ppt|pptx)$/i.test(lowerName)) return 'presentation';
    if (/\.(xls|xlsx)$/i.test(lowerName)) return 'sheet';
    if (/\.(doc|docx)$/i.test(lowerName)) return 'doc';
    if (/pdf/i.test(label)) return 'pdf';
    if (/ppt|presentation|slide/i.test(label)) return 'presentation';
    if (/xls|sheet|spreadsheet|excel/i.test(label)) return 'sheet';
    if (/doc|word/i.test(label)) return 'doc';
    if (/archive|zip/i.test(label)) return 'archive';
    return 'attachment';
}

export function AttachmentPreviewCard({
    fileName,
    href,
    kind,
    align = 'left',
    fileSize: initialFileSize,
}: AttachmentPreviewCardProps) {
    const isBlob = href.startsWith('blob:');
    const fileInfo = getFileTypeInfo(MIME_BY_KIND[kind]);
    const Icon = ICON_BY_KIND[kind] ?? File;
    const downloadFileName = getDownloadFileName(fileName, kind);

    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadSuccess, setDownloadSuccess] = useState(false);
    const [fileSize, setFileSize] = useState<number | undefined>(initialFileSize);

    useEffect(() => {
        if (initialFileSize !== undefined) {
            setFileSize(initialFileSize);
            return;
        }

        let isMounted = true;

        const fetchSize = async () => {
            try {
                if (href.startsWith('blob:')) {
                    const response = await fetch(href);
                    const blob = await response.blob();
                    if (isMounted) {
                        setFileSize(blob.size);
                    }
                    return;
                }

                const response = await fetch(href, { method: 'HEAD' });
                const contentLength = response.headers.get('content-length');
                if (contentLength && isMounted) {
                    setFileSize(parseInt(contentLength, 10));
                }
            } catch (error) {
                console.error('Failed to fetch file size for attachment:', error);
            }
        };

        fetchSize();

        return () => {
            isMounted = false;
        };
    }, [href, initialFileSize]);

    const handleDownload = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            await downloadFile(href, downloadFileName);
            setDownloadSuccess(true);
            setTimeout(() => setDownloadSuccess(false), 2000);
        } catch (error) {
            console.error('Attachment download failed:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className={`doc-preview-card group no-underline ${align === 'right' ? 'ml-auto' : ''}`}>
            <div className="flex items-center gap-2 p-3 mt-0.5 rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl hover:border-border/70 transition-all duration-300">
                <div
                    className="shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 shadow-sm"
                    style={{ background: fileInfo.bg, color: fileInfo.color }}
                >
                    <Icon className="w-6 h-6" strokeWidth={2} />
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground truncate tracking-tight">
                        {fileName}
                    </p>
                    <div className="flex items-center flex-wrap gap-2">
                        <span
                            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-white shadow-sm"
                            style={{ background: fileInfo.color }}
                        >
                            {fileInfo.label}
                        </span>
                        {fileSize !== undefined && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-muted-foreground shadow-sm bg-background/80">
                                {/* add the size of the file here */}
                                {formatBytes(fileSize)}
                            </span>
                        )}
                    </div>
                </div>

                {!isBlob && (
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className={`shrink-0 flex items-center cursor-pointer gap-2 px-4! py-2.5! rounded-xl! font-semibold text-sm border transition-all duration-300 group/btn no-underline! ${downloadSuccess
                            ? 'bg-success/10! text-success! border-success/30 hover:bg-success/20!'
                            : isDownloading
                                ? 'bg-primary/10! text-primary/70! border-primary/20 cursor-wait'
                                : 'bg-primary/5! text-primary! border-primary/20 hover:bg-primary/20! hover:text-primary! hover:border-primary! hover:shadow-md!'
                            }`}
                        aria-label={`Download ${downloadFileName}`}
                    >
                        {isDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                        ) : downloadSuccess ? (
                            <CheckCircle className="w-4 h-4" strokeWidth={2.5} />
                        ) : (
                            <Download className="w-4 h-4 transition-transform group-hover/btn:translate-y-0.5" strokeWidth={2.5} />
                        )}
                        <span className="hidden sm:inline text-sm font-medium">
                            {isDownloading ? 'Downloading...' : downloadSuccess ? 'Downloaded' : 'Download'}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
