'use client';

import { useEffect, useRef } from 'react';
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

    const links = Array.from(msg.content.matchAll(/\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g));

    // Calculate safe coordinates for desktop so it doesn't overflow
    const menuWidth = 160;
    const menuHeight = 200; // Estimated height with all actions
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 1000;

    const safeX = Math.min(position.x, windowWidth - menuWidth - 10);
    // If the menu would go off the bottom, open it upwards from the click point
    const safeY = (position.y + menuHeight > windowHeight - 10)
        ? Math.max(10, position.y - menuHeight)
        : position.y;

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
                const displayLabel = (() => {
                    const cleanLabel = label.replace(/^(📄 PDF: |📝 Doc: |📎 Attachment: )/, '');
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
                    <button key={idx} onClick={(e) => handleAction(() => onDownload(e, match[2], label || 'download'))} className="w-full rounded-sm text-left px-3 py-2.5 md:py-2 text-[14px] md:text-[13px] text-foreground hover:bg-primary/10 flex items-center">
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
                className="fixed z-101 w-40 bg-card border border-border rounded-xl shadow-2xl flex flex-col animate-in fade-in duration-75 overflow-hidden py-1"
                style={{ left: safeX, top: safeY }}
            >
                {menuContent}
            </div>
        </>
    );
}
