'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Reply, Copy, Pencil, Download, Trash2, X } from 'lucide-react';
import { ChatMessage, Role } from '@/types';
import { JwtPayload } from '@/context/GlobalContext';

interface MessageContextMenuProps {
    msg: ChatMessage;
    user: JwtPayload | null;
    isMine: boolean;
    isFailedMessage: boolean;
    position: { x: number, y: number };
    isMobile: boolean;
    onClose: () => void;
    onReply: (msg: ChatMessage) => void;
    onCopyText: (msg: ChatMessage) => void;
    onEditMessage: (msg: ChatMessage) => void;
    onDownload: (e: React.MouseEvent, url: string, label: string) => void;
    onDeleteMessage: (msgId: string) => void;
}

export function MessageContextMenu({
    msg, user, isMine, isFailedMessage, position, isMobile,
    onClose, onReply, onCopyText, onEditMessage, onDownload, onDeleteMessage
}: MessageContextMenuProps) {

    const ignoreFirstClickRef = useRef(true);
    const menuRef = useRef<HTMLDivElement>(null);
    const [desktopMenuStyle, setDesktopMenuStyle] = useState<CSSProperties>({
        left: position.x,
        top: position.y,
        visibility: 'hidden',
    });

    useEffect(() => {
        ignoreFirstClickRef.current = true;
        const timer = setTimeout(() => {
            ignoreFirstClickRef.current = false;
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleAction = (action: () => void) => {
        if (ignoreFirstClickRef.current) return;
        onClose();
        action();
    };

    const links = useMemo(() => Array.from(msg.content.matchAll(/!?\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g)), [msg.content]);

    useLayoutEffect(() => {
        if (isMobile) return;

        const updateMenuPosition = () => {
            const menu = menuRef.current;
            if (!menu) return;

            const margin = 10;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const availableHeight = Math.max(120, viewportHeight - margin * 2);
            const rect = menu.getBoundingClientRect();
            const renderedWidth = rect.width || 160;
            const renderedHeight = rect.height || 0;
            const visibleHeight = Math.min(renderedHeight, availableHeight);

            const left = Math.min(
                Math.max(margin, position.x),
                Math.max(margin, viewportWidth - renderedWidth - margin)
            );
            const top = Math.min(
                Math.max(margin, position.y),
                Math.max(margin, viewportHeight - visibleHeight - margin)
            );

            setDesktopMenuStyle({
                left,
                top,
                maxHeight: availableHeight,
                overflowY: renderedHeight > availableHeight ? 'auto' : 'hidden',
                visibility: 'visible',
            });
        };

        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isMobile, position.x, position.y, msg.content, isMine, isFailedMessage, user?.role]);

    const menuContent = (
        <>
            {!isFailedMessage && (
                <button onClick={() => handleAction(() => onReply(msg))} className="w-full rounded-sm text-left px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] text-foreground hover:bg-primary/10 flex items-center">
                    <Reply size={14} className="mr-3 md:mr-2 opacity-85 text-primary" /> Reply
                </button>
            )}
            <button onClick={() => handleAction(() => onCopyText(msg))} className="w-full rounded-sm text-left px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] text-foreground hover:bg-primary/10 flex items-center">
                <Copy size={14} className="mr-3 md:mr-2 opacity-85 text-warning" /> Copy Text
            </button>
            {isMine && !isFailedMessage && (
                <button onClick={() => handleAction(() => onEditMessage(msg))} className="w-full rounded-sm text-left px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] text-foreground hover:bg-primary/10 flex items-center">
                    <Pencil size={14} className="mr-3 md:mr-2 opacity-85 text-success" /> Edit
                </button>
            )}
            {links.map((match, idx) => {
                const label = (match[1] || '').trim();
                const cleanLabel = label.replace(/^(?:📄|📝|📊|📽️|📦|📎)?\s*(?:PDF:|DOC:|Doc:|XLS:|PPT:|ARCHIVE:|ZIP:|Attachment:)\s*/i, '');
                const displayLabel = (() => {
                    if (cleanLabel.length <= 16) return cleanLabel;
                    
                    const lastDot = cleanLabel.lastIndexOf('.');
                    // Only treat as extension if it's 1-5 chars long and near the end
                    if (lastDot !== -1 && cleanLabel.length - lastDot <= 6) {
                        const name = cleanLabel.substring(0, lastDot);
                        const ext = cleanLabel.substring(lastDot);
                        return `${name.substring(0, 10)}...${ext}`;
                    }
                    return `${cleanLabel.substring(0, 14)}...`;
                })();

                return (
                    <button key={idx} onClick={(e) => handleAction(() => onDownload(e, match[2], cleanLabel || 'download'))} className="w-full rounded-sm text-left px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] text-foreground hover:bg-primary/10 flex items-center">
                        <Download size={14} className="mr-3 md:mr-2 opacity-85 text-info" /> {displayLabel}
                    </button>
                );
            })}
            {(isMine || user?.role === Role.ORG_ADMIN) && (
                <div className='border-t border-border'>
                    <button onClick={() => handleAction(() => onDeleteMessage(msg.id))} className="w-full rounded-sm text-left px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] text-danger hover:bg-danger/10 flex items-center mt-1 pt-2 md:pt-1 md:mt-0">
                        <Trash2 size={14} className="mr-3 md:mr-2 opacity-85 text-danger" /> Delete
                    </button>
                </div>
            )}
        </>
    );

    if (isMobile) {
        return (
            <>
                <div className="fixed inset-0 z-50 bg-background/1 backdrop-blur-xs" onClick={onClose} />
                <div className="fixed bottom-0 left-0 right-0 z-51 bg-card border-t border-border rounded-t-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-8 duration-150 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <span className="text-sm font-bold text-muted-foreground tracking-wide">Message Options</span>
                        <button onClick={onClose} className="p-1 rounded-full bg-muted text-muted-foreground"><X size={16} /></button>
                    </div>
                    <div className="flex flex-col gap-1">
                        {menuContent}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="fixed inset-0 z-100" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
            <div
                ref={menuRef}
                className="fixed z-101 w-40 bg-card border border-border rounded-xl shadow-2xl flex flex-col animate-in fade-in duration-75 overflow-hidden py-1"
                style={desktopMenuStyle}
            >
                {menuContent}
            </div>
        </>
    );
}
