'use client';

import { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Shield, Loader2, Save, Lock, Unlock } from 'lucide-react';
import { Chat, User, Role, ChatParticipantRole, ChatType } from '@/types';
import { api } from '@/lib/api';
import { getUserColor } from '@/lib/utils';
import { BrandIcon } from '../ui/Brand';
import { PhotoUploadPicker } from '../ui/PhotoUploadPicker';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useGlobal } from '@/context/GlobalContext';
import { Modal } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface ChatSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    chat: Chat;
    currentUser: User;
    token: string;
    onUpdate: () => void;
    onAddParticipants: () => void;
}

export function ChatSettingsModal({
    isOpen,
    onClose,
    chat,
    currentUser,
    token,
    onUpdate,
    onAddParticipants
}: ChatSettingsModalProps) {
    const { dispatch } = useGlobal();
    const [name, setName] = useState(chat.name || '');
    const [avatarUrl, setAvatarUrl] = useState(chat.avatarUrl || '');
    const [readOnly, setReadOnly] = useState(chat.readOnly || false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => { },
    });

    useEffect(() => {
        if (isOpen) {
            setName(chat.name || '');
            setAvatarUrl(chat.avatarUrl || '');
            setReadOnly(chat.readOnly || false);
        }
    }, [isOpen, chat]);

    if (!isOpen) return null;

    const isGroupAdmin = currentUser.role === Role.ORG_ADMIN || chat.creatorId === currentUser.id;

    const handleSave = async () => {
        if (!name.trim()) return;
        try {
            setIsSaving(true);
            await api.chat.updateChat(chat.id, { name: name.trim(), avatarUrl, readOnly }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Chat settings updated', type: 'success' } });
            onUpdate();
            onClose();
        } catch (err) {
            console.error(err);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to update settings', type: 'error' } });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        const uploadOrgId = currentUser.organizationId || chat.organizationId;
        if (!uploadOrgId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Cannot determine organization for upload', type: 'error' } });
            return;
        }

        try {
            setIsUploading(true);
            // 1. Upload the file
            const res = await api.files.uploadFile(uploadOrgId, 'chat_avatar', chat.id, file, token);
            const newAvatarUrl = res.url || res.path;
            if (!newAvatarUrl) {
                throw new Error('Upload failed: no URL returned');
            }
            setAvatarUrl(newAvatarUrl);

            // 2. Immediate live update to the group chat record
            await api.chat.updateChat(chat.id, { avatarUrl: newAvatarUrl }, token);

            // 3. Notify parent (optional since socket will also trigger it, but good for local snappiness)
            onUpdate();

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Group picture updated successfully', type: 'success' } });
        } catch (err) {
            console.error(err);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to update group picture', type: 'error' } });
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveParticipant = (userId: string, userName: string) => {
        setConfirmConfig({
            isOpen: true,
            title: 'Remove Participant',
            description: `Are you sure you want to remove ${userName} from this group? They will no longer be able to see new messages or participate in the conversation.`,
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await api.chat.removeParticipant(chat.id, userId, token);
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Participant removed', type: 'success' } });
                    onUpdate();
                } catch (err) {
                    console.error(err);
                    dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to remove', type: 'error' } });
                }
            }
        });
    };

    const handleUpdateParticipantRole = async (userId: string, newRole: 'ADMIN' | 'MOD' | 'MEMBER') => {
        try {
            await api.chat.updateParticipantRole(chat.id, userId, newRole, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Participant role updated', type: 'success' } });
            onUpdate();
        } catch (err) {
            console.error(err);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to update role', type: 'error' } });
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-2xl"
            title={`${(chat.name || 'Chat').replace(/[()`]/g, '\\$&')} Settings`}
            subtitle="Members and group settings"
            footer={
                isGroupAdmin && (
                    <div className="p-3 sm:p-4 bg-card/5 border-t border-border flex justify-end space-x-2 sm:space-x-3">
                        <Button variant="secondary" onClick={onClose} py="py-1.5 sm:py-2" px="px-3 sm:px-4">Done</Button>
                        <Button
                            variant="primary"
                            onClick={handleSave}
                            disabled={isSaving || !name.trim()}
                            icon={Save}
                            py="py-1.5 sm:py-2"
                            px="px-4 sm:px-6"
                            isLoading={isSaving}
                        >
                            Save Changes
                        </Button>
                    </div>
                )
            }
        >
            <div className="space-y-6 sm:space-y-8">
                {/* Identification Section */}
                <div className="space-y-4 sm:space-y-6">
                    <div className="flex flex-col items-center">
                        <PhotoUploadPicker
                            currentImageUrl={avatarUrl}
                            onFileReady={handleAvatarUpload}
                            type="org"
                            disabled={!isGroupAdmin || isUploading}
                            hint={isGroupAdmin ? "Click to change group picture (256x256 recommended)" : "Only admins can change picture"}
                        />
                        {isUploading && (
                            <div className="mt-2 flex items-center text-[10px] text-primary font-bold animate-pulse">
                                <Loader2 size={12} className="mr-1.5 animate-spin" />
                                UPLOADING...
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="text-[11px] font-black text-muted-foreground tracking-widest mb-1.5 block ml-1">Group Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter group name"
                                disabled={!isGroupAdmin}
                                className="font-bold text-foreground bg-card/5 focus:bg-card/10"
                            />
                        </div>
                    </div>
                </div>

                {/* Read-Only Mode Toggle - Only for group chats */}
                {isGroupAdmin && chat.type === ChatType.GROUP && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/10 bg-card/30">
                        <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-2xl ${readOnly ? 'bg-primary/10 text-primary' : 'bg-muted/10 text-muted-foreground'}`}>
                                {readOnly ? <Lock size={16} /> : <Unlock size={16} />}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-foreground">Read-Only Mode</p>
                                <p className="text-[10px] text-muted-foreground">Only admins and moderators can send messages</p>
                            </div>
                        </div>
                        <Toggle
                            checked={readOnly}
                            onCheckedChange={setReadOnly}
                            offColor='bg-primary/20'
                        />
                    </div>
                )}

                <div className="h-px bg-border" />

                {/* Participants Section */}
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-muted-foreground tracking-widest block ml-1">Participants</label>
                        {isGroupAdmin && (
                            <button
                                onClick={() => { onAddParticipants(); }}
                                className="text-[10px] font-black text-primary/90 cursor-pointer hover:text-primary flex items-center bg-primary/10  hover:bg-primary/20 px-3 py-2 rounded-lg transition-all"
                            >
                                <UserPlus size={12} />
                                ADD NEW
                            </button>
                        )}
                    </div>

                    <div className="space-y-2 max-h-60 sm:max-h-75 overflow-y-auto pr-2 custom-scrollbar">
                        {chat.participants?.filter(p => p.isActive).map(p => {
                            const participantRole = p.role || ChatParticipantRole.MEMBER;
                            const isCreator = p.userId === chat.creatorId;
                            return (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border/10 bg-card/30 group/item transition-all hover:bg-card/80 hover:border-border hover:shadow-sm">
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                        <BrandIcon variant="user" user={p.user} size="sm" className="w-7 h-7 sm:w-8 sm:h-8" initialsFallback />
                                        <div className="min-w-0">
                                            <p className="text-[11px] sm:text-xs font-bold truncate" style={{ color: getUserColor(p.user?.id) }}>
                                                {p.user?.name} {p.userId === currentUser.id && '(You)'}
                                            </p>
                                            <div className="flex items-center space-x-1.5 sm:space-x-2">
                                                <p className="text-[10px] text-muted-foreground font-bold tracking-tighter">
                                                    {p.user?.role?.toLowerCase().replace('_', ' ')}
                                                </p>
                                                {isCreator && (
                                                    <span className="bg-primary/10 text-primary text-[10px] font-black px-1 sm:px-1.5 rounded-lg flex items-center">
                                                        <Shield size={12} className="mr-0.5" />
                                                        CREATOR
                                                    </span>
                                                )}
                                                {!isCreator && participantRole !== 'MEMBER' && (
                                                    <span className={`text-[10px] font-black px-1 sm:px-1.5 rounded-lg flex items-center ${participantRole === 'MOD' ? 'bg-info/10 text-info' : 'bg-success/10 text-success'}`}>
                                                        {participantRole}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        {isGroupAdmin && !isCreator && p.userId !== currentUser.id && (
                                            <select
                                                value={participantRole}
                                                onChange={(e) => handleUpdateParticipantRole(p.userId, e.target.value as 'ADMIN' | 'MOD' | 'MEMBER')}
                                                className="text-[8px] sm:text-[9px] font-bold bg-card/50 border border-border/30 rounded-lg px-1 sm:px-1.5 py-0.5 sm:py-1 focus:outline-none focus:border-primary/50"
                                            >
                                                <option value="MEMBER">Member</option>
                                                <option value="MOD">Mod</option>
                                                <option value="ADMIN">Admin</option>
                                            </select>
                                        )}
                                        {isGroupAdmin && p.userId !== currentUser.id && p.userId !== chat.creatorId && (
                                            <button
                                                onClick={() => handleRemoveParticipant(p.userId, p.user?.name || 'this participant')}
                                                className="p-1 sm:p-1.5 text-muted-foreground hover:text-danger cursor-pointer hover:bg-danger/10 rounded-lg transition-all"
                                                title="Remove from group"
                                            >
                                                <UserMinus size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <ConfirmDialog
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                title={confirmConfig.title}
                description={confirmConfig.description}
                onConfirm={confirmConfig.onConfirm}
                isDestructive={confirmConfig.isDestructive}
            />
        </Modal>
    );
}
