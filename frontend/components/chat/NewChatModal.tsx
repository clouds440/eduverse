'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { invalidateChats } from '@/lib/chatStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect, MultiSelectOption } from '@/components/ui/CustomMultiSelect';
import { Users, Shield, User as UserIcon, ChevronLeft, MessageSquarePlus } from 'lucide-react';
import { useGlobal } from '@/context/GlobalContext';
import { Role } from '@/types';
import { formatCourseSectionLabel } from '@/lib/utils';

const STABLE_EMPTY_ARRAY: string[] = [];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onChatCreated?: (chatId: string) => void;
    mode?: 'CREATE' | 'ADD_PARTICIPANTS';
    chatId?: string;
    existingParticipantIds?: string[];
}

export function NewChatModal({ isOpen, onClose, onChatCreated, mode = 'CREATE', chatId, existingParticipantIds = STABLE_EMPTY_ARRAY }: Props) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();

    const [type, setType] = useState<'DIRECT' | 'GROUP'>(mode === 'ADD_PARTICIPANTS' ? 'GROUP' : 'DIRECT');
    const [recipientId, setRecipientId] = useState('');
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');

    const [contactableUsers, setContactableUsers] = useState<MultiSelectOption[]>([]);
    const [isFetchingUsers, setIsFetchingUsers] = useState(false);

    // For Teachers: Quick add from Section
    const [sections, setSections] = useState<{ value: string; label: string }[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [isApplyingPreset, setIsApplyingPreset] = useState(false);

    useEffect(() => {
        if (!isOpen || !token || user?.role !== Role.TEACHER) return;

        const fetchSections = async () => {
            try {
                const res = await api.org.getSections(token, { my: true });
                setSections(res.data.map(s => ({
                    value: s.id,
                    label: formatCourseSectionLabel({ courseName: s.course?.name, sectionName: s.name }),
                })));
            } catch (err) {
                console.error('Failed to fetch sections', err);
            }
        };
        fetchSections();
    }, [isOpen, token, user?.role]);

    const handleSectionSelect = async (sectionId: string) => {
        setSelectedSectionId(sectionId);
        if (!sectionId || !token) return;

        setIsFetchingUsers(true);
        try {
            const section = await api.org.getSection(sectionId, token);
            if (section.students) {
                const studentIds = section.students.map(s => s.userId);
                // Merge with existing
                setParticipantIds(prev => Array.from(new Set([...prev, ...studentIds])));
                dispatch({
                    type: 'TOAST_ADD',
                    payload: {
                        message: `Added ${section.students.length} students from ${formatCourseSectionLabel({ courseName: section.course?.name, sectionName: section.name })}`,
                        type: 'success',
                    },
                });
            }
        } catch (err) {
            console.error('Failed to fetch section students', err);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to add section students', type: 'error' } });
        } finally {
            setIsFetchingUsers(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !token) return;

        const fetchUsers = async () => {
            setIsFetchingUsers(true);
            try {
                // Fetch explicitly from chat endpoint instead of mail contacts
                const users = await api.chat.searchUsers(token);
                // Filter out existing participants if in add mode
                let filteredUsers = mode === 'ADD_PARTICIPANTS'
                    ? users.filter(u => !existingParticipantIds.includes(u.id))
                    : users;

                // POLICY: No 1-to-1 chats with students. 
                // Exclude students if we are in DIRECT mode
                if (type === 'DIRECT') {
                    filteredUsers = filteredUsers.filter(u => u.role !== Role.STUDENT);
                }

                setContactableUsers(filteredUsers.map(u => ({
                    value: u.id,
                    label: `${u.name || u.email}${u.role ? ` (${u.role.replace('_', ' ')})` : ''}`,
                    icon: u.role && (u.role.includes('ADMIN') || u.role.includes('MANAGER')) ? Shield : UserIcon
                })));
            } catch (error) {
                console.error('Failed to fetch contactable users', error);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to load contacts', type: 'error' } });
            } finally {
                setIsFetchingUsers(false);
            }
        };

        fetchUsers();
    }, [isOpen, token, dispatch, mode, existingParticipantIds, type]);

    const applyPresetGroup = async (preset: { label: string; role?: string; source?: 'TEACHERS' | 'STUDENTS' | 'MANAGERS' }) => {
        if (!token) return;
        setIsApplyingPreset(true);
        try {
            let ids: string[] = [];

            if (preset.source === 'TEACHERS') {
                const res = await api.org.getTeachers(token, { page: 1, limit: 1000 });
                ids = res.data.map(t => t.user.id);
            } else if (preset.source === 'STUDENTS') {
                const res = await api.org.getStudents(token, { page: 1, limit: 1000 });
                ids = res.data.map(s => s.userId || s.user?.id).filter(Boolean) as string[];
            } else if (preset.source === 'MANAGERS') {
                const res = await api.org.getManagers(token, { page: 1, limit: 1000 });
                ids = res.data.map(m => m.user.id);
            } else if (preset.role) {
                const users = await api.chat.searchUsers(token);
                ids = users.filter(u => u.role === preset.role).map(u => u.id);
            }

            // Merge into participants
            setParticipantIds(prev => Array.from(new Set([...prev, ...ids])));
            dispatch({ type: 'TOAST_ADD', payload: { message: `Added ${ids.length} users to the group`, type: 'success' } });
            setGroupName(prev => prev || preset.label.replace('[GROUP] ', ''));
        } catch (err) {
            console.error('Failed to apply group preset', err);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to add preset members', type: 'error' } });
        } finally {
            setIsApplyingPreset(false);
        }
    };

    const resetForm = () => {
        setRecipientId('');
        setParticipantIds([]);
        setGroupName('');
        setSelectedSectionId('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: mode === 'ADD_PARTICIPANTS' ? 'chat-add-participants' : 'chat-create' });
            if (mode === 'ADD_PARTICIPANTS') {
                if (!chatId) throw new Error('Chat ID is missing');
                if (participantIds.length === 0) throw new Error('Please select at least one person');
                await api.chat.addParticipants(chatId, participantIds, token);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Participants added successfully', type: 'success' } });
                invalidateChats();
                onChatCreated?.(chatId);
                resetForm();
                onClose();
                return;
            }

            let newChatId: string;
            if (type === 'DIRECT') {
                if (!recipientId) throw new Error('Please select a recipient');
                const chat = await api.chat.createDirectChat(recipientId, token);
                newChatId = chat.id;
            } else {
                if (!groupName) throw new Error('Please enter a group name');
                if (participantIds.length === 0) throw new Error('Please select at least one participant');
                const chat = await api.chat.createGroupChat(groupName, participantIds, token);
                newChatId = chat.id;
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Chat created successfully', type: 'success' } });
            invalidateChats();
            onChatCreated?.(newChatId);
            resetForm();
            onClose();
        } catch (error) {
            const err = error as Error;
            dispatch({ type: 'TOAST_ADD', payload: { message: err.message || 'Failed to process request', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: mode === 'ADD_PARTICIPANTS' ? 'chat-add-participants' : 'chat-create' });
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'ADD_PARTICIPANTS' ? "Add Participants" : "Start New Conversation"}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-8">
                {mode === 'CREATE' && (
                    <div className="bg-card -mx-6 px-6 py-4 border-b border-border">
                        <Label className="text-[10px] font-black tracking-widest text-primary/70 mb-3 block">Conversation Type</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <button
                                type="button"
                                onClick={() => setType('DIRECT')}
                                className={`flex items-center p-3 sm:p-4 rounded-xl border-2 transition-all group ${type === 'DIRECT'
                                    ? 'border-primary bg-primary/5 ring-4 ring-primary/5'
                                    : 'border-border bg-card hover:border-border'
                                    }`}
                            >
                                <div className={`p-2.5 sm:p-3 rounded-lg mr-3 sm:mr-4 transition-colors ${type === 'DIRECT' ? 'bg-primary text-foreground' : 'bg-background/50 text-primary border border-primary group-hover:bg-background/50'}`}>
                                    <UserIcon size={20} className="sm:w-6 sm:h-6" />
                                </div>
                                <div className="text-left">
                                    <span className={`block text-xs sm:text-sm font-bold ${type === 'DIRECT' ? 'text-primary' : 'text-foreground'}`}>Direct Message</span>
                                    <span className="text-[10px] sm:text-[11px] text-foreground/70 font-medium tracking-tight">1-on-1 private chat</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setType('GROUP')}
                                className={`flex items-center p-3 sm:p-4 rounded-xl border-2 transition-all group ${type === 'GROUP'
                                    ? 'border-primary bg-primary/5 ring-4 ring-primary/5'
                                    : 'border-border bg-card hover:border-border'
                                    }`}
                            >
                                <div className={`p-2.5 sm:p-3 rounded-lg mr-3 sm:mr-4 transition-colors ${type === 'GROUP' ? 'bg-primary text-foreground' : 'bg-background/50 text-primary border border-primary group-hover:bg-background/50'}`}>
                                    <Users size={20} className="sm:w-6 sm:h-6" />
                                </div>
                                <div className="text-left">
                                    <span className={`block text-xs sm:text-sm font-bold ${type === 'GROUP' ? 'text-primary' : 'text-foreground'}`}>Group Chat</span>
                                    <span className="text-[10px] sm:text-[11px] text-foreground/70 font-medium tracking-tight">Chat with multiple people</span>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className={`${type === 'GROUP' && mode === 'CREATE' ? 'md:col-span-5' : 'md:col-span-12'} space-y-6`}>
                        {type === 'GROUP' && mode === 'CREATE' && (
                            <div className="animate-in fade-in slide-in-from-left duration-300">
                                <Label className="text-xs font-bold text-foreground mb-1.5 block">Group Details</Label>
                                <Input
                                    required
                                    value={groupName}
                                    onChange={e => setGroupName(e.target.value)}
                                    placeholder={user?.role === Role.PLATFORM_ADMIN || user?.role === Role.SUPER_ADMIN ? "e.g. Platform Announcement" : "e.g. Study Group"}
                                    icon={Users}
                                    className="h-12"
                                />

                                {/* Quick group presets */}
                                <div className="mt-4 pt-4 border-t border-border">
                                    <Label className="text-[10px] font-black text-foreground mb-3 block">Quick Templates</Label>
                                    <div className="flex flex-col gap-2">
                                        {(user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) && (
                                            <>
                                                <button type="button" disabled={isApplyingPreset} onClick={() => applyPresetGroup({ label: '[GROUP] All Teachers', source: 'TEACHERS' })} className="px-4 py-2 bg-accent border border-border hover:border-primary hover:bg-primary/5 rounded-lg text-[12px] font-bold text-foreground transition-all text-left flex items-center justify-between group">
                                                    <span>All Teachers</span>
                                                    <ChevronLeft className="w-3 h-3 opacity-0 group-hover:opacity-40 rotate-180" />
                                                </button>
                                                <button type="button" disabled={isApplyingPreset} onClick={() => applyPresetGroup({ label: '[GROUP] All Students', source: 'STUDENTS' })} className="px-4 py-2 bg-accent border border-border hover:border-primary hover:bg-primary/5 rounded-lg text-[12px] font-bold text-foreground transition-all text-left flex items-center justify-between group">
                                                    <span>All Students</span>
                                                    <ChevronLeft className="w-3 h-3 opacity-0 group-hover:opacity-40 rotate-180" />
                                                </button>
                                                {user?.role === Role.ORG_ADMIN && (
                                                    <button type="button" disabled={isApplyingPreset} onClick={() => applyPresetGroup({ label: '[GROUP] All Managers', source: 'MANAGERS' })} className="px-4 py-2 bg-accent border border-border hover:border-primary hover:bg-primary/5 rounded-lg text-[12px] font-bold text-foreground transition-all text-left flex items-center justify-between group">
                                                        <span>All Managers</span>
                                                        <ChevronLeft className="w-3 h-3 opacity-0 group-hover:opacity-40 rotate-180" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {(user?.role === Role.PLATFORM_ADMIN || user?.role === Role.SUPER_ADMIN) && (
                                            <button type="button" disabled={isApplyingPreset} onClick={() => applyPresetGroup({ label: '[GROUP] Platform Admins', role: Role.PLATFORM_ADMIN })} className="px-4 py-2 bg-accent border border-border hover:border-primary hover:bg-primary/5 rounded-lg text-[12px] font-bold text-foreground transition-all text-left flex items-center justify-between group">
                                                <span>Platform Admins</span>
                                                <ChevronLeft className="w-3 h-3 opacity-0 group-hover:opacity-40 rotate-180" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={`${type === 'GROUP' && mode === 'CREATE' ? 'md:col-span-7' : 'md:col-span-12'} space-y-6`}>
                        <div>
                            <Label className="text-xs font-bold text-foreground mb-1.5 block">
                                {type === 'DIRECT' ? 'Select Contact' : 'Invite Participants'}
                            </Label>

                            {type === 'GROUP' && user?.role === Role.TEACHER && sections.length > 0 && (
                                <div className="mb-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                                    <Label className="text-[10px] text-primary font-black mb-2 flex items-center">
                                        <Users className="w-3 h-3 mr-1.5" />
                                        Smart Add
                                    </Label>
                                    <CustomSelect
                                        options={sections}
                                        value={selectedSectionId}
                                        onChange={handleSectionSelect}
                                        placeholder="Add whole section..."
                                        icon={Users}
                                    />
                                </div>
                            )}

                            <div className="min-h-30">
                                {type === 'DIRECT' ? (
                                    <CustomSelect
                                        value={recipientId}
                                        onChange={setRecipientId}
                                        options={contactableUsers.map(u => ({ ...u, value: u.value }))}
                                        placeholder={isFetchingUsers ? "Loading contacts..." : "Search and select a person..."}
                                        searchable
                                        disabled={isFetchingUsers}
                                        required
                                        icon={UserIcon}
                                    />
                                ) : (
                                    <CustomMultiSelect
                                        values={participantIds}
                                        onChange={setParticipantIds}
                                        options={contactableUsers}
                                        placeholder={isFetchingUsers ? "Loading staff & students..." : "Select collaborators..."}
                                        disabled={isFetchingUsers}
                                        icon={Users}
                                    />
                                )}
                            </div>
                            <div className="mt-4 p-4 bg-accent rounded-xl border border-border text-[11px] text-foreground font-medium leading-relaxed">
                                {mode === 'ADD_PARTICIPANTS'
                                    ? "Add more members to current group. Newly added members will see all future messages."
                                    : type === 'DIRECT'
                                        ? "Direct messages are end-to-end between you and the recipient."
                                        : "Group participants can be managed later by the creator."}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-border -mx-6 px-6 pb-2">
                    <Button variant="secondary" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" icon={mode === 'ADD_PARTICIPANTS' ? Users : MessageSquarePlus} loadingId={mode === 'ADD_PARTICIPANTS' ? 'chat-add-participants' : 'chat-create'} className="px-10 shadow-lg shadow-primary/20">
                        {mode === 'ADD_PARTICIPANTS' ? 'Add' : 'Create Chat'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
