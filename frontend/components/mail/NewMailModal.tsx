'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AlertCircle, FileText, ImageIcon, Paperclip, User, Users, X } from 'lucide-react';
import { ModalForm } from '@/components/ui/ModalForm';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { CustomMultiSelect } from '@/components/ui/CustomMultiSelect';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { MailTarget, Role, MailCategory } from '@/types';
import { ADMIN_REPLY_TEMPLATES } from './MailTemplates';
import { useGlobal } from '@/context/GlobalContext';
import { Toggle } from '@/components/ui/Toggle';

interface NewMailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialTargetId?: string;
    initialSubject?: string;
}

const PLATFORM_CATEGORIES = [
    { value: MailCategory.ACCOUNT_STATUS, label: 'Account Status' },
    { value: MailCategory.BUG_REPORT, label: 'Bug Report' },
    { value: MailCategory.FEATURE_REQUEST, label: 'Feature Request' },
    { value: MailCategory.BILLING, label: 'Billing' },
    { value: MailCategory.PLATFORM_SUPPORT, label: 'Platform Support' },
];

const PLATFORM_TO_ORG_CATEGORIES = [
    { value: MailCategory.ORG_COMPLIANCE, label: 'Org Compliance' },
    { value: MailCategory.ORG_ACCOUNT, label: 'Org Account' },
    { value: MailCategory.PLATFORM_NOTICE, label: 'Platform Notice' },
    { value: MailCategory.GENERAL_INQUIRY, label: 'General Inquiry' },
];

const ORG_ADMIN_TO_STAFF_CATEGORIES = [
    { value: MailCategory.TASK_ASSIGNMENT, label: 'Task Assignment' },
    { value: MailCategory.SCHEDULE_CHANGE, label: 'Schedule Change' },
    { value: MailCategory.POLICY_UPDATE, label: 'Policy Update' },
    { value: MailCategory.PERFORMANCE, label: 'Performance' },
    { value: MailCategory.GENERAL_NOTICE, label: 'General Notice' },
];

const TEACHER_CATEGORIES = [
    { value: MailCategory.LEAVE_REQUEST, label: 'Leave Request' },
    { value: MailCategory.RESOURCE_REQUEST, label: 'Resource Request' },
    { value: MailCategory.SCHEDULE_CONFLICT, label: 'Schedule Conflict' },
    { value: MailCategory.COLLABORATION, label: 'Collaboration' },
    { value: MailCategory.GENERAL_INQUIRY, label: 'General Inquiry' },
];

const FINANCE_CATEGORIES = [
    { value: MailCategory.BILLING, label: 'Billing' },
    { value: MailCategory.GENERAL_INQUIRY, label: 'General Inquiry' },
    { value: MailCategory.OTHER, label: 'Other' },
];

const UNIVERSAL_CATEGORIES = [
    { value: MailCategory.GENERAL_INQUIRY, label: 'General Inquiry' },
    { value: MailCategory.OTHER, label: 'Other' },
];

function getCategoriesForContext(
    senderRole: Role | undefined,
    recipientRoles: string[],
): { value: string; label: string }[] {
    let base: { value: string; label: string }[] = UNIVERSAL_CATEGORIES;

    if (senderRole && recipientRoles.length > 0) {
        const recipientUpper = recipientRoles[0].toUpperCase();

        if (senderRole === Role.SUPER_ADMIN || senderRole === Role.PLATFORM_ADMIN) {
            base = recipientUpper === Role.ORG_ADMIN
                ? [...PLATFORM_TO_ORG_CATEGORIES, ...UNIVERSAL_CATEGORIES]
                : [...PLATFORM_CATEGORIES, ...UNIVERSAL_CATEGORIES];
        } else if (senderRole === Role.ORG_ADMIN || senderRole === Role.SUB_ADMIN) {
            base = recipientUpper === Role.SUPER_ADMIN || recipientUpper === Role.PLATFORM_ADMIN
                ? [...PLATFORM_CATEGORIES, ...UNIVERSAL_CATEGORIES]
                : [...ORG_ADMIN_TO_STAFF_CATEGORIES, ...UNIVERSAL_CATEGORIES];
        } else if (senderRole === Role.ORG_MANAGER || senderRole === Role.TEACHER) {
            base = [...TEACHER_CATEGORIES, ...UNIVERSAL_CATEGORIES];
        } else if (senderRole === Role.FINANCE_MANAGER) {
            base = [...FINANCE_CATEGORIES, ...UNIVERSAL_CATEGORIES];
        } else if (senderRole === Role.GUARDIAN) {
            base = [...FINANCE_CATEGORIES, ...UNIVERSAL_CATEGORIES];
        }
    }

    const seen = new Set<string>();
    return base.filter((category) => {
        if (seen.has(category.value)) return false;
        seen.add(category.value);
        return true;
    });
}

const PRIORITIES = [
    { value: 'LOW', label: 'Low' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
];

const MEGA_GROUPS = ['ROLE:ORG_STAFF', 'ROLE:PLATFORM_ADMIN'];
const ADMIN_TEMPLATE_OPTIONS = ADMIN_REPLY_TEMPLATES.map((template) => ({
    label: template.name,
    content: template.content,
}));

function formatRole(role?: string) {
    return role ? role.replace(/_/g, ' ') : 'Unknown role';
}

function resolveTargetSelection(incomingIds: string[], previousIds: string[], targets: MailTarget[]) {
    const targetMap = new Map(targets.map((target) => [target.id, target]));
    const addedIds = incomingIds.filter((id) => !previousIds.includes(id));
    let finalIds = [...incomingIds];
    let feedback = '';

    for (const addedId of addedIds) {
        const addedTarget = targetMap.get(addedId);
        if (!addedTarget) continue;

        const activeTargetsList = finalIds.map((id) => targetMap.get(id)).filter(Boolean) as MailTarget[];

        if (activeTargetsList.length > 1 && MEGA_GROUPS.includes(addedId)) {
            finalIds = [addedId];
            feedback = `Targeting ${addedTarget.label} clears the other selections.`;
            break;
        }

        const activeMegaGroup = finalIds.find((id) => MEGA_GROUPS.includes(id) && id !== addedId);
        if (activeMegaGroup) {
            finalIds = finalIds.filter((id) => !MEGA_GROUPS.includes(id));
        }

        if (addedTarget.type === 'ROLE') {
            if (addedTarget.role === Role.TEACHER || addedTarget.role === Role.ORG_MANAGER) {
                finalIds = finalIds.filter((id) => id !== 'ROLE:ORG_STAFF');
            }

            finalIds = finalIds.filter((id) => {
                if (id === addedId) return true;
                const target = targetMap.get(id);
                return !(target?.type === 'USER' && target.role === addedTarget.role);
            });
        } else if (addedTarget.type === 'USER') {
            const groupSelected = finalIds.some((id) => {
                const target = targetMap.get(id);
                return target?.type === 'ROLE' && target.role === addedTarget.role;
            });

            if (groupSelected) {
                finalIds = finalIds.filter((id) => id !== addedId);
                feedback = `${addedTarget.label} is already included in the selected group.`;
            }
        }
    }

    return { finalIds, feedback };
}

export function NewMailModal({
    isOpen,
    onClose,
    onSuccess,
    initialTargetId,
    initialSubject,
}: NewMailModalProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState<string>(MailCategory.GENERAL_INQUIRY);
    const [priority, setPriority] = useState('NORMAL');
    const [message, setMessage] = useState('');
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [targets, setTargets] = useState<MailTarget[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [noReply, setNoReply] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const targetMap = useMemo(() => new Map(targets.map((target) => [target.id, target])), [targets]);
    const selectedTargets = useMemo(
        () => targetIds.map((id) => targetMap.get(id)).filter(Boolean) as MailTarget[],
        [targetIds, targetMap],
    );

    const isPlatformAdmin = user?.role === Role.PLATFORM_ADMIN || user?.role === Role.SUPER_ADMIN;
    const primaryTarget = selectedTargets[0];
    const isTargetingPlatform = selectedTargets.some((target) => target.role === Role.PLATFORM_ADMIN || target.role === Role.SUPER_ADMIN);
    const showNoReply = (isPlatformAdmin || user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN) &&
        !(user?.role !== Role.SUPER_ADMIN && user?.role !== Role.PLATFORM_ADMIN && isTargetingPlatform);

    const todayLabel = useMemo(() => new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), []);
    const orgData = useMemo<Record<string, string>>(() => {
        if (!isPlatformAdmin) return {} as Record<string, string>;

        return {
            name: primaryTarget?.label || 'User',
            id: primaryTarget?.id || 'ID',
            admin: user?.name || 'Administrator',
            role: user?.role || 'Platform Admin',
            date: todayLabel,
            signature: 'EduVerse Support',
        } satisfies Record<string, string>;
    }, [isPlatformAdmin, primaryTarget?.id, primaryTarget?.label, todayLabel, user?.name, user?.role]);

    const availableCategories = useMemo(
        () => getCategoriesForContext(user?.role as Role | undefined, selectedTargets.map((target) => target.role || '')),
        [selectedTargets, user?.role],
    );

    const targetOptions = useMemo(
        () => targets.map((target) => ({
            value: target.id,
            label: target.type === 'ROLE' ? `${target.label} group` : target.label,
            icon: target.type === 'ROLE' ? Users : User,
        })),
        [targets],
    );

    const templateOptions = useMemo(() => isPlatformAdmin ? ADMIN_TEMPLATE_OPTIONS : [], [isPlatformAdmin]);

    useEffect(() => {
        if (!isOpen || !token) return;

        let cancelled = false;
        setSearching(true);

        api.mail.getContactableUsers(token)
            .then((data) => {
                if (cancelled) return;

                setTargets(data);
                if (initialTargetId) {
                    const { finalIds, feedback } = resolveTargetSelection([initialTargetId], [], data);
                    setTargetIds(finalIds);
                    setInfo(feedback);

                    const nextTargets = finalIds
                        .map((id) => data.find((target) => target.id === id))
                        .filter(Boolean) as MailTarget[];
                    const nextCategories = getCategoriesForContext(user?.role as Role | undefined, nextTargets.map((target) => target.role || ''));
                    setCategory((current) => nextCategories.some((item) => item.value === current)
                        ? current
                        : nextCategories[0]?.value || MailCategory.GENERAL_INQUIRY);
                }
                if (initialSubject) setSubject(initialSubject);
            })
            .catch((err) => {
                console.error(err);
                if (!cancelled) setError('Unable to load recipients.');
            })
            .finally(() => {
                if (!cancelled) setSearching(false);
            });

        return () => {
            cancelled = true;
        };
    }, [initialSubject, initialTargetId, isOpen, token, user?.role]);

    useEffect(() => {
        if (!error && !info) return;

        const timer = window.setTimeout(() => {
            setError('');
            setInfo('');
        }, 3500);

        return () => window.clearTimeout(timer);
    }, [error, info]);

    const handleTargetChange = useCallback((newTargetIds: string[]) => {
        const { finalIds, feedback } = resolveTargetSelection(newTargetIds, targetIds, targets);
        const nextTargets = finalIds.map((id) => targetMap.get(id)).filter(Boolean) as MailTarget[];
        const nextCategories = getCategoriesForContext(user?.role as Role | undefined, nextTargets.map((target) => target.role || ''));

        setError('');
        setInfo(feedback);
        setTargetIds(finalIds);
        setCategory((current) => nextCategories.some((item) => item.value === current)
            ? current
            : nextCategories[0]?.value || MailCategory.GENERAL_INQUIRY);
    }, [targetIds, targetMap, targets, user?.role]);

    const handleCategoryChange = useCallback((value: string) => {
        setCategory(value);
    }, []);

    const handlePriorityChange = useCallback((value: string) => {
        setPriority(value);
    }, []);

    const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const filesArray = event.target.files ? Array.from(event.target.files) : [];
        const validFiles = filesArray.filter((file) => file.type.startsWith('image/') || file.type === 'application/pdf');

        if (validFiles.length < filesArray.length) {
            setError('Only images and PDF files are allowed.');
        }

        setSelectedFiles((current) => [...current, ...validFiles].slice(0, 5));
        event.target.value = '';
    }, []);

    const removeFile = useCallback((index: number) => {
        setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    }, []);

    const handleSubmit = useCallback(async (event: FormEvent) => {
        event.preventDefault();
        if (!subject.trim() || !message.trim()) {
            setError('Subject and message are required.');
            return;
        }
        if (targetIds.length === 0) {
            setError('Please select at least one recipient.');
            return;
        }
        if (!token) {
            setError('Authentication expired.');
            return;
        }

        try {
            setSubmitting(true);
            setError('');
            dispatch({ type: 'UI_START_PROCESSING', payload: 'new-mail-submit' });

            const roleTarget = selectedTargets.find((target) => target.type === 'ROLE');
            const individualIds = selectedTargets.filter((target) => target.type === 'USER').map((target) => target.id);

            const response = await api.mail.createMail({
                subject,
                category: category as MailCategory,
                priority,
                message,
                assigneeIds: individualIds.length > 0 ? individualIds : undefined,
                targetRole: roleTarget?.role || undefined,
                noReply,
            }, token);

            if (selectedFiles.length > 0) {
                const messageId = response.messages?.[0]?.id;
                const orgId = response.organizationId || 'SYSTEM';

                if (messageId) {
                    await Promise.all(
                        selectedFiles.map((file) =>
                            api.files.uploadFile(orgId, 'MAIL_MESSAGE', messageId, file, token),
                        ),
                    );
                }
            }

            setSubject('');
            setCategory(MailCategory.GENERAL_INQUIRY);
            setPriority('NORMAL');
            setMessage('');
            setTargetIds([]);
            setSelectedFiles([]);
            setNoReply(false);
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send mail.');
        } finally {
            setSubmitting(false);
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'new-mail-submit' });
        }
    }, [category, dispatch, message, noReply, onClose, onSuccess, priority, selectedFiles, selectedTargets, subject, targetIds.length, token]);

    return (
        <ModalForm
            isOpen={isOpen}
            onClose={onClose}
            title="Compose Mail"
            onSubmit={handleSubmit}
            submitText="Send Mail"
            isSubmitting={submitting}
            loadingId="new-mail-submit"
            maxWidth="max-w-6xl"
            bodyClassName="px-4 py-4 sm:px-5 md:px-6 md:py-5"
            feedback={
                error ? (
                    <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 p-3 text-danger">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-xs font-bold leading-relaxed">{error}</p>
                    </div>
                ) : info ? (
                    <div className="flex items-start gap-3 rounded-xl border border-info/20 bg-info/10 p-3 text-info">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-xs font-bold leading-relaxed">{info}</p>
                    </div>
                ) : null
            }
        >
            <div className="space-y-5">
                <div>
                    <label htmlFor="mail-subject" className="mb-2 block text-xs font-black uppercase tracking-widest text-muted-foreground">
                        Subject
                    </label>
                    <input
                        id="mail-subject"
                        type="text"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        placeholder="Briefly summarize the mail"
                        className="w-full rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-base font-bold text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-4 focus:ring-primary/10"
                    />
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <section className="space-y-4 rounded-2xl border border-border/70 bg-background/45 p-4">
                        <div>
                            <h3 className="text-sm font-black text-foreground">Recipients and settings</h3>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                Choose people or groups, then set the routing details.
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-widest text-muted-foreground">
                                Recipients
                            </label>
                            <CustomMultiSelect
                                values={targetIds}
                                onChange={handleTargetChange}
                                options={targetOptions}
                                className="w-full"
                                placeholder={searching ? 'Loading recipients...' : 'Select recipients...'}
                                disabled={searching}
                            />

                            <div className="mt-3 max-h-36 overflow-y-auto rounded-xl border border-border/60 bg-card/50 p-2 custom-scrollbar">
                                {selectedTargets.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedTargets.map((target) => (
                                            <div key={target.id} className="flex min-w-0 items-start gap-2 rounded-lg bg-background/70 px-3 py-2">
                                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                    {target.type === 'ROLE' ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-black text-foreground">{target.label}</p>
                                                    <p className="truncate text-[11px] font-semibold text-muted-foreground">
                                                        {target.type === 'USER'
                                                            ? `${target.email || 'No email'} - ${formatRole(target.role)}`
                                                            : target.description || 'Recipient group'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground">
                                        No recipients selected.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    Category
                                </label>
                                <CustomSelect
                                    value={category}
                                    onChange={handleCategoryChange}
                                    options={availableCategories}
                                    className="w-full"
                                    placeholder="Select category"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    Priority
                                </label>
                                <CustomSelect
                                    value={priority}
                                    onChange={handlePriorityChange}
                                    options={PRIORITIES}
                                    className="w-full"
                                    placeholder="Select priority"
                                />
                            </div>
                        </div>

                        {showNoReply && (
                            <div className="rounded-xl border border-border/70 bg-card/50 p-3">
                                <Toggle
                                    checked={noReply}
                                    onCheckedChange={setNoReply}
                                    label="No Reply"
                                    description="Recipients can read this mail but cannot respond."
                                />
                            </div>
                        )}

                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                                    Attachments
                                </label>
                                <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                                    {selectedFiles.length} / 5
                                </span>
                            </div>

                            <div className="flex min-h-24 flex-col gap-2 rounded-xl border border-dashed border-border/70 bg-card/40 p-3">
                                {selectedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedFiles.map((file, index) => (
                                            <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2">
                                                {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 shrink-0 text-primary" /> : <FileText className="h-4 w-4 shrink-0 text-primary" />}
                                                <span className="max-w-44 truncate text-xs font-bold text-foreground">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(index)}
                                                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                                                    title="Remove file"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {selectedFiles.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2.5 text-xs font-black text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                    >
                                        <Paperclip className="h-4 w-4" />
                                        Add images or PDFs
                                    </button>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*,.pdf"
                                multiple
                            />
                        </div>
                    </section>

                    <section className="flex min-h-0 flex-col rounded-2xl border border-border/70 bg-background/45 p-4">
                        <div className="mb-3">
                            <h3 className="text-sm font-black text-foreground">Message</h3>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">
                                Markdown is supported for structure, links, and lists.
                            </p>
                        </div>

                        <MarkdownEditor
                            value={message}
                            onChange={setMessage}
                            placeholder="Write the full message..."
                            rows={10}
                            templates={templateOptions}
                            orgData={orgData}
                            className="min-h-80"
                        />
                    </section>
                </div>
            </div>
        </ModalForm>
    );
}
