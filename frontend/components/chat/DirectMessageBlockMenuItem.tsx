'use client';

import { useMemo, useState } from 'react';
import { Ban, ShieldCheck } from 'lucide-react';
import { blockDirectMessages, getDmBlockAction, unblockDirectMessages } from '@/lib/communicationBlocks';
import { Chat, User } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface DirectMessageBlockMenuItemProps {
    chat: Chat;
    currentUser: User;
    token: string;
    onCloseMenu: () => void;
    onChanged: () => void;
}

export function DirectMessageBlockMenuItem({
    chat,
    currentUser,
    token,
    onCloseMenu,
    onChanged,
}: DirectMessageBlockMenuItemProps) {
    const { dispatch } = useGlobal();
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const action = useMemo(() => getDmBlockAction(chat, currentUser), [chat, currentUser]);

    if (!action) return null;

    const Icon = action.isBlockedByMe ? ShieldCheck : Ban;

    const performAction = async () => {
        try {
            if (action.isBlockedByMe) {
                await unblockDirectMessages(action.targetUser.id, token);
            } else {
                await blockDirectMessages(action.targetUser.id, token);
            }
            onChanged();
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: action.isBlockedByMe ? 'DMs unblocked' : 'DMs blocked',
                    type: 'success',
                },
            });
        } catch (error) {
            console.error('Failed to update DM block:', error);
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: action.isBlockedByMe ? 'Failed to unblock DMs' : 'Failed to block DMs',
                    type: 'error',
                },
            });
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    setIsConfirmOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <Icon size={14} />
                {action.label}
            </button>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => {
                    setIsConfirmOpen(false);
                    onCloseMenu();
                }}
                onConfirm={() => { void performAction(); }}
                title={action.confirmTitle}
                description={action.confirmDescription}
                confirmText={action.confirmText}
                isDestructive={!action.isBlockedByMe}
            />
        </>
    );
}
