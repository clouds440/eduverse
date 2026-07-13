'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Unlock } from 'lucide-react';
import { api } from '@/lib/api';
import { unblockDirectMessages } from '@/lib/communicationBlocks';
import { CommunicationBlock } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ChatAvatar } from './ChatAvatar';
import { getRoleLabel } from '@/lib/roles';

interface BlockedDmUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    onChanged?: () => void;
}

export function BlockedDmUsersModal({ isOpen, onClose, token, onChanged }: BlockedDmUsersModalProps) {
    const { dispatch } = useGlobal();
    const [blocks, setBlocks] = useState<CommunicationBlock[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);

    const fetchBlocks = useCallback(async () => {
        if (!isOpen || !token) return;
        setIsLoading(true);
        try {
            const data = await api.chat.getCommunicationBlocks(token);
            setBlocks(data);
        } catch (error) {
            console.error('Failed to load blocked DM users:', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to load blocked DMs', type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, isOpen, token]);

    useEffect(() => {
        void fetchBlocks();
    }, [fetchBlocks]);

    const handleUnblock = async (targetUserId: string) => {
        setUnblockingId(targetUserId);
        try {
            await unblockDirectMessages(targetUserId, token);
            setBlocks(prev => prev.filter(block => block.targetUserId !== targetUserId));
            onChanged?.();
            dispatch({ type: 'TOAST_ADD', payload: { message: 'DMs unblocked', type: 'success' } });
        } catch (error) {
            console.error('Failed to unblock DMs:', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to unblock DMs', type: 'error' } });
        } finally {
            setUnblockingId(null);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Blocked DMs"
            subtitle="Blocking only stops one-on-one direct messages. Group chats are unchanged."
            maxWidth="max-w-lg"
            mobileMode="sheet"
        >
            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                </div>
            ) : blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No blocked DMs</p>
                    <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                        People you block from direct messages will appear here.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {blocks.map(block => (
                        <div
                            key={block.id}
                            className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3"
                        >
                            <ChatAvatar targetUser={block.targetUser} className="h-10 w-10 shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">
                                    {block.targetUser.name || block.targetUser.email}
                                </p>
                                <p className="truncate text-xs font-medium text-muted-foreground">
                                    {getRoleLabel(block.targetUser.role, 'User')}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                icon={Unlock}
                                isLoading={unblockingId === block.targetUserId}
                                onClick={() => { void handleUnblock(block.targetUserId); }}
                            >
                                Unblock
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}
