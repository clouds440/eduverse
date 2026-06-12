'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { CustomSelect, DropdownOption } from '@/components/ui/CustomSelect';
import { TargetType, Role, AnnouncementPriority } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { Send, Type, Megaphone, Globe, Building2, Shield, Layout, User } from 'lucide-react';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { getRoleLabel } from '@/lib/roles';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

function getErrorMessage(error: unknown) {
    if (typeof error === 'object' && error !== null) {
        const maybeResponse = error as { response?: { data?: { message?: string } } };
        if (typeof maybeResponse.response?.data?.message === 'string') {
            return maybeResponse.response.data.message;
        }
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Failed to create announcement';
}

export function CreateAnnouncementModal({ isOpen, onClose, onSuccess }: Props) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [targetType, setTargetType] = useState<TargetType>(TargetType.GLOBAL);
    const [targetId, setTargetId] = useState('');
    const [actionUrl, setActionUrl] = useState('');
    const [priority, setPriority] = useState<AnnouncementPriority>(AnnouncementPriority.NORMAL);
    // Target Selection States
    const [targetOptions, setTargetOptions] = useState<DropdownOption[]>([]);
    const [isFetchingTargets, setIsFetchingTargets] = useState(false);

    const isPlatformAdmin = user?.role === Role.SUPER_ADMIN || user?.role === Role.PLATFORM_ADMIN;

    // Fetch targets based on targetType
    useEffect(() => {
        if (!isOpen || !token || !user) return;

        const fetchTargets = async () => {
            setTargetOptions([]);
            setIsFetchingTargets(true);
            try {
                if (targetType === TargetType.SECTION) {
                    const res = await api.org.getSections(token, { limit: 100 });
                    setTargetOptions(res.data.map(s => ({ value: s.id, label: s.name, icon: Layout })));
                } else if (targetType === TargetType.ORG && isPlatformAdmin) {
                    const res = await api.admin.getOrganizations(token, { limit: 100 });
                    setTargetOptions(res.data.map(o => ({ value: o.id, label: o.name, icon: Building2 })));
                } else if (targetType === TargetType.ROLE) {
                    const roles = [
                        { value: Role.SUPER_ADMIN, label: getRoleLabel(Role.SUPER_ADMIN), icon: Shield },
                        { value: Role.PLATFORM_ADMIN, label: getRoleLabel(Role.PLATFORM_ADMIN), icon: Shield },
                        { value: Role.ORG_ADMIN, label: getRoleLabel(Role.ORG_ADMIN), icon: Shield },
                        { value: Role.ORG_MANAGER, label: getRoleLabel(Role.ORG_MANAGER), icon: Shield },
                        { value: Role.TEACHER, label: getRoleLabel(Role.TEACHER), icon: User },
                        { value: Role.STUDENT, label: getRoleLabel(Role.STUDENT), icon: User },
                    ].filter(r => {
                        const isPlatformRole = r.value === Role.SUPER_ADMIN || r.value === Role.PLATFORM_ADMIN;
                        if (!isPlatformAdmin && isPlatformRole) return false;
                        if (user?.role === Role.ORG_MANAGER && r.value === Role.ORG_ADMIN) return false;
                        // Org users cannot target other Org Admins/Managers unless they are Super/Platform Admin
                        if (!isPlatformAdmin && (r.value === Role.ORG_ADMIN || r.value === Role.ORG_MANAGER) && user?.role !== Role.ORG_ADMIN) return false;
                        return true;
                    });
                    setTargetOptions(roles);
                }
            } catch (error) {
                console.error('Failed to fetch targets', error);
            } finally {
                setIsFetchingTargets(false);
            }
        };

        if (targetType !== TargetType.GLOBAL) {
            fetchTargets();
        }
    }, [targetType, isOpen, token, isPlatformAdmin, user]);

    // Reset or set default targetId when type changes
    useEffect(() => {
        if (targetType === TargetType.ORG && !isPlatformAdmin && user?.organizationId) {
            setTargetId(user.organizationId);
        } else {
            setTargetId('');
        }
    }, [targetType, isPlatformAdmin, user?.organizationId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        const normalizedActionUrl = actionUrl.trim()
            ? normalizeSafeUrl(actionUrl, { allowRelative: true }) || undefined
            : undefined;

        if (actionUrl.trim() && !normalizedActionUrl) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Action URL must be a safe https URL or internal path.', type: 'error' } });
            return;
        }

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: 'announcement-submit' });
            await api.announcements.createAnnouncement({
                title,
                body,
                targetType,
                targetId: targetId || undefined,
                actionUrl: normalizedActionUrl,
                priority
            }, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Announcement created successfully', type: 'success' } });

            // Reset state
            setTitle('');
            setBody('');
            setTargetType(TargetType.GLOBAL);
            setTargetId('');
            setActionUrl('');
            setPriority(AnnouncementPriority.NORMAL);

            onSuccess?.();
            onClose();
        } catch (error: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: getErrorMessage(error), type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'announcement-submit' });
        }
    };

    if (!user || user.role === Role.STUDENT) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create Announcement"
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <Label>Title <span className="text-danger">*</span></Label>
                    <Input
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Schedule Update"
                        icon={Type}
                    />
                </div>

                <div>
                    <Label>Message <span className="text-danger">*</span></Label>
                    <Textarea
                        required
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        icon={Type}
                        className="h-32"
                        placeholder="Type your message here..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <Label>Priority</Label>
                        <CustomSelect
                            value={priority}
                            onChange={(val) => setPriority(val as AnnouncementPriority)}
                            options={[
                                { value: AnnouncementPriority.LOW, label: 'Low', icon: Megaphone, iconClassName: 'text-muted-foreground' },
                                { value: AnnouncementPriority.NORMAL, label: 'Normal', icon: Megaphone, iconClassName: 'text-primary' },
                                { value: AnnouncementPriority.HIGH, label: 'High', icon: Megaphone, iconClassName: 'text-warning' },
                                { value: AnnouncementPriority.URGENT, label: 'Urgent 🔴', icon: Megaphone, iconClassName: 'text-danger' },
                            ]}
                        />
                    </div>

                    <div>
                        <Label>Audience <span className="text-danger">*</span></Label>
                        <CustomSelect
                            value={targetType}
                            onChange={(val) => setTargetType(val as TargetType)}
                            options={[
                                ...(isPlatformAdmin ? [{ value: TargetType.GLOBAL, label: 'Global', icon: Globe }] : []),
                                ...(user.role !== Role.TEACHER ? [{ value: TargetType.ORG, label: 'Organization-wide', icon: Building2 }] : []),
                                ...(user.role === Role.ORG_ADMIN || isPlatformAdmin ? [{ value: TargetType.ROLE, label: 'Specific Role', icon: Shield }] : []),
                                { value: TargetType.SECTION, label: 'Specific Section', icon: Layout },
                            ]}
                        />
                    </div>
                </div>

                {targetType !== TargetType.GLOBAL && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label>Select {targetType.toLowerCase().replace('_', ' ')} <span className="text-danger">*</span></Label>
                        {targetType === TargetType.ORG && !isPlatformAdmin ? (
                            <div className="px-4 py-3 bg-card/80 border border-border/10 rounded-lg text-sm font-bold text-card-text/60 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Current Organization
                            </div>
                        ) : (
                            <CustomSelect
                                value={targetId}
                                onChange={setTargetId}
                                options={targetOptions}
                                placeholder={isFetchingTargets ? "Loading..." : `Select ${targetType.toLowerCase().replace('_', ' ')}...`}
                                searchable={targetOptions.length > 5}
                                disabled={isFetchingTargets}
                                required
                            />
                        )}
                        <p className="text-[10px] text-card-header font-bold tracking-widest mt-2 ml-1">
                            This announcement will only be visible to members of the selected {targetType.toLowerCase().replace('_', ' ')}.
                        </p>
                    </div>
                )}

                <div>
                    <Label>Action URL (Optional)</Label>
                    <Input
                        type="url"
                        value={actionUrl}
                        onChange={e => setActionUrl(e.target.value)}
                        placeholder="https://example.com/details"
                        icon={Globe}
                    />
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-border/5 bg-card/5 -mx-8 -mb-8 px-8 pb-8">
                    <Button variant="secondary" onClick={onClose} type="button" px="px-8" py="py-2.5">
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" icon={Send} loadingId="announcement-submit" loadingText="SENDING..." px="px-8" py="py-2.5">
                        Send Announcement
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
