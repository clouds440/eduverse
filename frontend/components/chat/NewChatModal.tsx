'use client';

import { useCallback, useMemo, useState, useEffect, useRef, useId } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { invalidateChats } from '@/lib/chatStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { CustomSelect, type DropdownOption } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { Badge } from '@/components/ui/Badge';
import { Users, Shield, User as UserIcon, ChevronLeft, MessageSquarePlus, X } from 'lucide-react';
import { useGlobal } from '@/context/GlobalContext';
import { ChatSearchUser, Role } from '@/types';
import { formatCourseSectionLabel } from '@/lib/utils';
import { getRoleLabel } from '@/lib/roles';

const STABLE_EMPTY_ARRAY: string[] = [];

const SEARCHABLE_ROLE_OPTIONS = [
    Role.ORG_ADMIN,
    Role.SUB_ADMIN,
    Role.ORG_MANAGER,
    Role.FINANCE_MANAGER,
    Role.TEACHER,
    Role.STUDENT,
    Role.GUARDIAN,
    Role.SUPER_ADMIN,
    Role.PLATFORM_ADMIN,
];

type ChatUserOption = DropdownOption<string> & {
    user: ChatSearchUser;
};

type ChatPresetKey =
    | 'PLATFORM_ADMINS'
    | 'ALL_TEACHERS'
    | 'ALL_MANAGERS'
    | 'ALL_SUB_ADMINS'
    | 'ALL_FINANCE_MANAGERS'
    | 'ALL_GUARDIANS'
    | 'GUARDIANS_BY_COHORT'
    | 'ALL_STUDENTS'
    | 'STUDENTS_BY_COHORT'
    | 'STUDENTS_BY_DEPARTMENT'
    | 'TEACHERS_BY_DEPARTMENT';

type ChatPresetRequirement = 'cohort' | 'department';

interface ChatPreset {
    key: ChatPresetKey;
    label: string;
    groupName: string;
    requirement?: ChatPresetRequirement;
}

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
    const formId = useId();
    const canCreateGroups = !!user &&
        user.role !== Role.STUDENT &&
        user?.role !== Role.GUARDIAN &&
        user?.role !== Role.FINANCE_MANAGER;

    const [type, setType] = useState<'DIRECT' | 'GROUP'>(mode === 'ADD_PARTICIPANTS' ? 'GROUP' : 'DIRECT');
    const [recipientId, setRecipientId] = useState('');
    const [participantIds, setParticipantIds] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');

    const [selectedRole, setSelectedRole] = useState<Role | ''>('');
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [lastSearchQuery, setLastSearchQuery] = useState('');
    const [contactableUsers, setContactableUsers] = useState<ChatUserOption[]>([]);
    const [selectedUsersById, setSelectedUsersById] = useState<Record<string, ChatSearchUser>>({});
    const [isFetchingUsers, setIsFetchingUsers] = useState(false);
    const searchRequestIdRef = useRef(0);

    // For Teachers: Quick add from Section
    const [sections, setSections] = useState<{ value: string; label: string }[]>([]);
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [isApplyingPreset, setIsApplyingPreset] = useState(false);
    const [cohortOptions, setCohortOptions] = useState<DropdownOption<string>[]>([]);
    const [departmentOptions, setDepartmentOptions] = useState<DropdownOption<string>[]>([]);
    const [selectedPresetCohortId, setSelectedPresetCohortId] = useState('');
    const [selectedPresetDepartmentId, setSelectedPresetDepartmentId] = useState('');

    const visiblePresets = useMemo<ChatPreset[]>(() => {
        if (!user || mode !== 'CREATE') return [];

        if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
            return [{ key: 'PLATFORM_ADMINS', label: 'Platform Admins', groupName: 'Platform Admins' }];
        }

        if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
            return [
                { key: 'ALL_TEACHERS', label: 'All Teachers', groupName: 'All Teachers' },
                { key: 'ALL_STUDENTS', label: 'All Students', groupName: 'All Students' },
                { key: 'ALL_MANAGERS', label: 'All Managers', groupName: 'All Managers' },
                { key: 'ALL_SUB_ADMINS', label: 'All Sub Admins', groupName: 'All Sub Admins' },
                { key: 'ALL_FINANCE_MANAGERS', label: 'All Finance Managers', groupName: 'All Finance Managers' },
                { key: 'ALL_GUARDIANS', label: 'All Guardians', groupName: 'All Guardians' },
                { key: 'STUDENTS_BY_COHORT', label: 'Students by Cohort', groupName: 'Cohort Students', requirement: 'cohort' },
                { key: 'GUARDIANS_BY_COHORT', label: 'Guardians by Cohort', groupName: 'Cohort Guardians', requirement: 'cohort' },
                { key: 'TEACHERS_BY_DEPARTMENT', label: 'Teachers by Department', groupName: 'Department Teachers', requirement: 'department' },
                { key: 'STUDENTS_BY_DEPARTMENT', label: 'Students by Department', groupName: 'Department Students', requirement: 'department' },
            ];
        }

        if (user.role === Role.ORG_MANAGER) {
            return [
                { key: 'ALL_TEACHERS', label: 'All Assigned Teachers', groupName: 'Assigned Teachers' },
                { key: 'ALL_STUDENTS', label: 'All Assigned Students', groupName: 'Assigned Students' },
                { key: 'STUDENTS_BY_COHORT', label: 'Students by Cohort', groupName: 'Cohort Students', requirement: 'cohort' },
                { key: 'TEACHERS_BY_DEPARTMENT', label: 'Teachers by Department', groupName: 'Department Teachers', requirement: 'department' },
                { key: 'STUDENTS_BY_DEPARTMENT', label: 'Students by Department', groupName: 'Department Students', requirement: 'department' },
            ];
        }

        if (user.role === Role.TEACHER) {
            return [
                { key: 'ALL_STUDENTS', label: 'All Assigned Students', groupName: 'Assigned Students' },
                { key: 'STUDENTS_BY_COHORT', label: 'Students by Cohort', groupName: 'Cohort Students', requirement: 'cohort' },
                { key: 'STUDENTS_BY_DEPARTMENT', label: 'Students by Department', groupName: 'Department Students', requirement: 'department' },
            ];
        }

        return [];
    }, [mode, user]);

    const needsPresetCohort = visiblePresets.some((preset) => preset.requirement === 'cohort');
    const needsPresetDepartment = visiblePresets.some((preset) => preset.requirement === 'department');
    const basePresets = useMemo(() => visiblePresets.filter((preset) => !preset.requirement), [visiblePresets]);
    const cohortPresets = useMemo(() => visiblePresets.filter((preset) => preset.requirement === 'cohort'), [visiblePresets]);
    const departmentPresets = useMemo(() => visiblePresets.filter((preset) => preset.requirement === 'department'), [visiblePresets]);
    const selectedPresetCohortLabel = useMemo(
        () => cohortOptions.find((option) => option.value === selectedPresetCohortId)?.label,
        [cohortOptions, selectedPresetCohortId],
    );
    const selectedPresetDepartmentLabel = useMemo(
        () => departmentOptions.find((option) => option.value === selectedPresetDepartmentId)?.label,
        [departmentOptions, selectedPresetDepartmentId],
    );

    useEffect(() => {
        if (mode === 'CREATE' && !canCreateGroups && type === 'GROUP') {
            setType('DIRECT');
        }
    }, [canCreateGroups, mode, type]);

    const roleOptions = useMemo<DropdownOption<string>[]>(() => {
        if (!user) return [];

        const roles = (() => {
            if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
                return [Role.SUPER_ADMIN, Role.PLATFORM_ADMIN];
            }
            if (user.role === Role.ORG_ADMIN || user.role === Role.SUB_ADMIN) {
                return [
                    Role.ORG_ADMIN,
                    Role.SUB_ADMIN,
                    Role.ORG_MANAGER,
                    Role.FINANCE_MANAGER,
                    Role.TEACHER,
                    Role.STUDENT,
                    Role.GUARDIAN,
                ];
            }
            if (user.role === Role.ORG_MANAGER) return [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.TEACHER, Role.STUDENT];
            if (user.role === Role.TEACHER) return [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.STUDENT];
            if (user.role === Role.STUDENT) return [Role.TEACHER];
            if (user.role === Role.GUARDIAN) return [Role.ORG_ADMIN, Role.SUB_ADMIN, Role.FINANCE_MANAGER];
            if (user.role === Role.FINANCE_MANAGER) return [Role.ORG_ADMIN, Role.SUB_ADMIN];
            return SEARCHABLE_ROLE_OPTIONS;
        })();

        return roles.map((role) => ({
            value: role,
            label: getRoleLabel(role),
            icon: role.includes('ADMIN') || role.includes('MANAGER') ? Shield : UserIcon,
        }));
    }, [user]);

    useEffect(() => {
        if (!selectedRole && roleOptions.length > 0) {
            setSelectedRole(roleOptions[0].value as Role);
        }
    }, [roleOptions, selectedRole]);

    const resetUserSearch = useCallback(() => {
        setContactableUsers([]);
        setUserSearchQuery('');
        setLastSearchQuery('');
        setRecipientId('');
        searchRequestIdRef.current += 1;
        setIsFetchingUsers(false);
    }, []);

    const handleRoleChange = useCallback((role: string) => {
        setSelectedRole(role as Role);
        resetUserSearch();
    }, [resetUserSearch]);

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

    useEffect(() => {
        if (!isOpen || !token || type !== 'GROUP' || mode !== 'CREATE') return;

        let cancelled = false;

        const fetchPresetFilters = async () => {
            try {
                const [cohortsResult, departmentsResult] = await Promise.all([
                    needsPresetCohort
                        ? api.cohorts.getCohorts(token, { page: 1, limit: 1000, includeAllCycles: true })
                        : Promise.resolve(null),
                    needsPresetDepartment
                        ? api.org.getDepartments(token, { page: 1, limit: 1000, isActive: true })
                        : Promise.resolve(null),
                ]);

                if (cancelled) return;

                if (cohortsResult) {
                    setCohortOptions(cohortsResult.data.map((cohort) => ({
                        value: cohort.id,
                        label: cohort.code ? `${cohort.name} (${cohort.code})` : cohort.name,
                    })));
                }

                if (departmentsResult) {
                    setDepartmentOptions(departmentsResult.data.map((department) => ({
                        value: department.id,
                        label: department.code ? `${department.name} (${department.code})` : department.name,
                    })));
                }
            } catch (err) {
                console.error('Failed to fetch chat preset filters', err);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to load group shortcut filters', type: 'error' } });
            }
        };

        fetchPresetFilters();

        return () => {
            cancelled = true;
        };
    }, [dispatch, isOpen, mode, needsPresetCohort, needsPresetDepartment, token, type]);

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

    const toUserOption = useCallback((targetUser: ChatSearchUser): ChatUserOption => {
        const linkedStudents = targetUser.guardianProfile?.studentLinks
            ?.map(link => link.student?.user?.name || link.student?.registrationNumber || link.student?.rollNumber)
            .filter(Boolean) as string[] | undefined;

        const description = targetUser.role === Role.STUDENT
            ? [targetUser.studentProfile?.registrationNumber, targetUser.studentProfile?.rollNumber].filter(Boolean).join(' / ')
            : targetUser.role === Role.TEACHER || targetUser.role === Role.ORG_MANAGER
                ? targetUser.teacherProfile?.designation || targetUser.email
                : targetUser.email;

        const meta = targetUser.role === Role.STUDENT
            ? targetUser.email
            : undefined;

        return {
            value: targetUser.id,
            label: targetUser.name || targetUser.email,
            description,
            meta,
            badges: targetUser.role === Role.GUARDIAN ? linkedStudents : undefined,
            avatarUser: targetUser,
            user: targetUser,
        };
    }, []);

    const handleUserSearch = useCallback(async (query: string) => {
        setUserSearchQuery(query);
        const search = query.trim();
        const requestId = searchRequestIdRef.current + 1;
        searchRequestIdRef.current = requestId;

        if (!token || !selectedRole || search.length < 2) {
            setContactableUsers([]);
            setLastSearchQuery('');
            setIsFetchingUsers(false);
            return;
        }

        setIsFetchingUsers(true);
        setLastSearchQuery(search);
        setContactableUsers([]);
        try {
            const users = await api.chat.searchUsers(token, { search, role: selectedRole });
            if (requestId !== searchRequestIdRef.current) return;
            const filteredUsers = users.filter((targetUser) => {
                if (mode === 'ADD_PARTICIPANTS' && existingParticipantIds.includes(targetUser.id)) return false;
                return true;
            });

            setContactableUsers(filteredUsers.map(toUserOption));
        } catch (error) {
            if (requestId !== searchRequestIdRef.current) return;
            console.error('Failed to search contactable users', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to search contacts', type: 'error' } });
        } finally {
            if (requestId === searchRequestIdRef.current) {
                setIsFetchingUsers(false);
            }
        }
    }, [dispatch, existingParticipantIds, mode, selectedRole, toUserOption, token]);

    const applyPresetGroup = async (preset: ChatPreset) => {
        if (!token) return;

        const cohortId = preset.requirement === 'cohort' ? selectedPresetCohortId : undefined;
        const departmentId = preset.requirement === 'department' ? selectedPresetDepartmentId : undefined;

        if (preset.requirement === 'cohort' && !cohortId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Choose a cohort first', type: 'info' } });
            return;
        }
        if (preset.requirement === 'department' && !departmentId) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Choose a department first', type: 'info' } });
            return;
        }

        setIsApplyingPreset(true);
        try {
            const users = await api.chat.getPresetUsers(token, {
                preset: preset.key,
                cohortId,
                departmentId,
            });
            const eligibleUsers = users.filter((targetUser) => {
                if (mode === 'ADD_PARTICIPANTS' && existingParticipantIds.includes(targetUser.id)) return false;
                return true;
            });
            const ids = eligibleUsers.map((targetUser) => targetUser.id);

            setParticipantIds(prev => Array.from(new Set([...prev, ...ids])));
            setSelectedUsersById(prev => {
                const next = { ...prev };
                eligibleUsers.forEach((targetUser) => {
                    next[targetUser.id] = targetUser;
                });
                return next;
            });
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: ids.length > 0 ? `Added ${ids.length} users to the group` : 'No users found for this shortcut',
                    type: ids.length > 0 ? 'success' : 'info',
                },
            });
            setGroupName(prev => prev || preset.groupName);
        } catch (err) {
            console.error('Failed to apply group preset', err);
            const message = err instanceof Error ? err.message : 'Failed to add preset members';
            dispatch({ type: 'TOAST_ADD', payload: { message, type: 'error' } });
        } finally {
            setIsApplyingPreset(false);
        }
    };

    const resetForm = () => {
        setRecipientId('');
        setParticipantIds([]);
        setGroupName('');
        setSelectedSectionId('');
        setSelectedPresetCohortId('');
        setSelectedPresetDepartmentId('');
        setSelectedUsersById({});
        resetUserSearch();
    };

    const rememberSelectedUsers = useCallback((ids: string[]) => {
        const selectedUsers = contactableUsers
            .filter(option => ids.includes(option.value))
            .map(option => option.user);

        if (selectedUsers.length === 0) return;

        setSelectedUsersById(prev => {
            const next = { ...prev };
            selectedUsers.forEach((selected) => {
                next[selected.id] = selected;
            });
            return next;
        });
    }, [contactableUsers]);

    const handleRecipientChange = useCallback((userId: string) => {
        setRecipientId(userId);
        rememberSelectedUsers(userId ? [userId] : []);
    }, [rememberSelectedUsers]);

    const handleParticipantsChange = useCallback((nextParticipantIds: string[]) => {
        setParticipantIds(nextParticipantIds);
        rememberSelectedUsers(nextParticipantIds);
    }, [rememberSelectedUsers]);

    const removeParticipant = useCallback((userId: string) => {
        setParticipantIds(prev => prev.filter(id => id !== userId));
        setSelectedUsersById(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
        });
    }, []);

    const clearParticipants = useCallback(() => {
        setParticipantIds([]);
        setSelectedUsersById({});
    }, []);

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

    const selectedContactOptions = useMemo(
        () => Object.values(selectedUsersById).map(toUserOption),
        [selectedUsersById, toUserOption],
    );
    const contactOptions = useMemo(() => {
        const seen = new Set<string>();
        return [...selectedContactOptions, ...contactableUsers].filter((option) => {
            if (seen.has(option.value)) return false;
            seen.add(option.value);
            return true;
        });
    }, [contactableUsers, selectedContactOptions]);
    const availableContactOptions = useMemo(
        () => contactOptions.filter(option => mode !== 'ADD_PARTICIPANTS' || !existingParticipantIds.includes(option.value)),
        [contactOptions, existingParticipantIds, mode],
    );
    const contactSearchPlaceholder = selectedRole === Role.STUDENT
        ? 'Search roll no, reg no, name, email, phone...'
        : selectedRole === Role.TEACHER || selectedRole === Role.ORG_MANAGER
            ? 'Search name, email, phone, designation...'
            : selectedRole === Role.GUARDIAN
                ? 'Search guardian or linked student...'
                : 'Search name, email, phone...';
    const contactEmptyMessage = !selectedRole
        ? 'Select a role first.'
        : userSearchQuery.trim().length < 2
            ? 'Type at least 2 characters to search.'
            : lastSearchQuery
                ? `No ${getRoleLabel(selectedRole).toLowerCase()} found for "${lastSearchQuery}".`
                : 'Type to search contacts.';
    const selectedParticipantUsers = participantIds
        .map(id => selectedUsersById[id])
        .filter(Boolean);
    const renderPresetButton = (preset: ChatPreset) => {
        const disabledByRequirement =
            (preset.requirement === 'cohort' && !selectedPresetCohortId) ||
            (preset.requirement === 'department' && !selectedPresetDepartmentId);

        return (
            <button
                key={preset.key}
                type="button"
                disabled={isApplyingPreset || disabledByRequirement}
                onClick={() => applyPresetGroup(preset)}
                className="flex min-h-10 w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <span className="truncate">{preset.label}</span>
                <ChevronLeft className="ml-2 h-3 w-3 shrink-0 rotate-180 opacity-45" />
            </button>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'ADD_PARTICIPANTS' ? "Add Participants" : "Start New Conversation"}
            maxWidth="max-w-5xl"
            bodyClassName="px-3 py-3 sm:px-5 sm:py-5"
            footer={
                <div className="flex flex-row justify-end gap-3">
                    <Button variant="secondary" onClick={onClose} type="button">
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form={formId}
                        variant="primary"
                        icon={mode === 'ADD_PARTICIPANTS' ? Users : MessageSquarePlus}
                        loadingId={mode === 'ADD_PARTICIPANTS' ? 'chat-add-participants' : 'chat-create'}
                        className="px-8 shadow-lg shadow-primary/20 sm:px-10"
                    >
                        {mode === 'ADD_PARTICIPANTS' ? 'Add' : 'Create Chat'}
                    </Button>
                </div>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="space-y-5">
                {mode === 'CREATE' && (
                    <div className="rounded-lg border border-border bg-card/60 p-3 sm:p-4">
                        <Label className="mb-3 block text-[10px] font-black uppercase tracking-widest text-primary/70">Conversation Type</Label>
                        <div className={`grid grid-cols-1 ${canCreateGroups ? 'sm:grid-cols-2' : ''} gap-2 sm:gap-3`}>
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
                            {canCreateGroups && (
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
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                    <div className={`${type === 'GROUP' && mode === 'CREATE' ? 'lg:col-span-5' : 'lg:col-span-12'} space-y-5`}>
                        {type === 'GROUP' && mode === 'CREATE' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left duration-300">
                                <section className="rounded-lg border border-border bg-card/60 p-3 sm:p-4">
                                    <Label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Group Name</Label>
                                    <Input
                                        required
                                        value={groupName}
                                        onChange={e => setGroupName(e.target.value)}
                                        placeholder={user?.role === Role.PLATFORM_ADMIN || user?.role === Role.SUPER_ADMIN ? "e.g. Platform Announcement" : "e.g. Study Group"}
                                        icon={Users}
                                        className="h-11"
                                    />
                                </section>

                                {visiblePresets.length > 0 && (
                                    <section className="space-y-3 rounded-lg border border-border bg-card/60 p-3 sm:p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <Label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shortcuts</Label>
                                            {isApplyingPreset && <span className="text-[10px] font-bold text-primary">Adding...</span>}
                                        </div>

                                        {basePresets.length > 0 && (
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {basePresets.map(renderPresetButton)}
                                            </div>
                                        )}

                                        {cohortPresets.length > 0 && (
                                            <div className="space-y-2 rounded-lg border border-border/70 bg-background/45 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cohort</Label>
                                                    {selectedPresetCohortLabel && (
                                                        <span className="max-w-40 truncate text-[10px] font-bold text-primary">{selectedPresetCohortLabel}</span>
                                                    )}
                                                </div>
                                                <CustomSelect
                                                    options={cohortOptions}
                                                    value={selectedPresetCohortId}
                                                    onChange={setSelectedPresetCohortId}
                                                    placeholder="Choose cohort..."
                                                    icon={Users}
                                                    searchable
                                                    clearable
                                                    clearLabel="Clear cohort"
                                                    disabled={cohortOptions.length === 0}
                                                />
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {cohortPresets.map(renderPresetButton)}
                                                </div>
                                            </div>
                                        )}

                                        {departmentPresets.length > 0 && (
                                            <div className="space-y-2 rounded-lg border border-border/70 bg-background/45 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Department</Label>
                                                    {selectedPresetDepartmentLabel && (
                                                        <span className="max-w-40 truncate text-[10px] font-bold text-primary">{selectedPresetDepartmentLabel}</span>
                                                    )}
                                                </div>
                                                <CustomSelect
                                                    options={departmentOptions}
                                                    value={selectedPresetDepartmentId}
                                                    onChange={setSelectedPresetDepartmentId}
                                                    placeholder="Choose department..."
                                                    icon={Users}
                                                    searchable
                                                    clearable
                                                    clearLabel="Clear department"
                                                    disabled={departmentOptions.length === 0}
                                                />
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {departmentPresets.map(renderPresetButton)}
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={`${type === 'GROUP' && mode === 'CREATE' ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-5`}>
                        <section className="rounded-lg border border-border bg-card/60 p-3 sm:p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <Label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    {type === 'DIRECT' ? 'Contact' : 'Participants'}
                                </Label>
                                {type === 'GROUP' && (
                                    <Badge variant="primary" size="sm">{participantIds.length}</Badge>
                                )}
                            </div>

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

                            <div className="min-h-30 space-y-3">
                                <div>
                                    <Label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        {type === 'DIRECT' ? 'Select Individual Contact' : 'Add Individual Participant'}
                                    </Label>
                                    <p className="text-[11px] font-semibold text-muted-foreground">
                                        Choose a role, then search for one person to add.
                                    </p>
                                </div>
                                <CustomSelect
                                    value={selectedRole}
                                    onChange={handleRoleChange}
                                    options={roleOptions}
                                    placeholder="Select role..."
                                    icon={Shield}
                                    disabled={roleOptions.length === 0}
                                    required
                                />

                                {type === 'DIRECT' ? (
                                    <CustomSelect
                                        value={recipientId}
                                        onChange={handleRecipientChange}
                                        options={availableContactOptions}
                                        placeholder="Search and select a person..."
                                        disabled={!selectedRole}
                                        required
                                        icon={UserIcon}
                                        searchable
                                        searchValue={userSearchQuery}
                                        onSearchChange={handleUserSearch}
                                        searchPlaceholder={contactSearchPlaceholder}
                                        isSearching={isFetchingUsers}
                                        emptyMessage={contactEmptyMessage}
                                    />
                                ) : (
                                    <>
                                        <CustomMultiSelect
                                            values={participantIds}
                                            onChange={handleParticipantsChange}
                                            options={availableContactOptions}
                                            placeholder="Search and add participants..."
                                            disabled={!selectedRole}
                                            icon={Users}
                                            searchable
                                            searchValue={userSearchQuery}
                                            onSearchChange={handleUserSearch}
                                            searchPlaceholder={contactSearchPlaceholder}
                                            isSearching={isFetchingUsers}
                                            emptyMessage={contactEmptyMessage}
                                            hideSelectedValues
                                        />
                                        <div className="rounded-xl border border-border bg-background/55 p-3">
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Selected</span>
                                                {participantIds.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={clearParticipants}
                                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                                                    >
                                                        <X className="h-3 w-3" aria-hidden="true" />
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            {participantIds.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedParticipantUsers.map((participant) => (
                                                        <button
                                                            key={participant.id}
                                                            type="button"
                                                            onClick={() => removeParticipant(participant.id)}
                                                            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-foreground transition-colors hover:border-danger/40 hover:text-danger"
                                                            title="Remove participant"
                                                        >
                                                            {participant.name || participant.email}
                                                        </button>
                                                    ))}
                                                    {participantIds.length > selectedParticipantUsers.length && (
                                                        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                                                            {participantIds.length - selectedParticipantUsers.length} added from template
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs font-semibold text-muted-foreground">
                                                    No participants selected.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="mt-4 p-4 bg-accent rounded-xl border border-border text-[11px] text-foreground font-medium leading-relaxed">
                                {mode === 'ADD_PARTICIPANTS'
                                    ? "Add more members to current group. Newly added members will see all future messages."
                                    : type === 'DIRECT'
                                        ? "Direct messages are end-to-end between you and the recipient."
                                        : "Group participants can be managed later by the creator."}
                            </div>
                        </section>
                    </div>
                </div>

            </form>
        </Modal>
    );
}
