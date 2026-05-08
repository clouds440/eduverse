import React, { useState, useRef, useMemo } from 'react';
import { AlertCircle, Paperclip, X, FileText, ImageIcon, User, Users } from 'lucide-react';
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

// ── Category groups by communication context ─────────────────────────────────

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

const UNIVERSAL_CATEGORIES = [
    { value: MailCategory.GENERAL_INQUIRY, label: 'General Inquiry' },
    { value: MailCategory.OTHER, label: 'Other' },
];

/**
 * Returns the correct subset of categories based on the sender's role
 * and the selected recipients' roles.
 */
function getCategoriesForContext(
    senderRole: Role | undefined,
    recipientRoles: string[],
): { value: string; label: string }[] {
    let base: { value: string; label: string }[] = UNIVERSAL_CATEGORIES;

    if (senderRole && recipientRoles.length > 0) {
        const recipientUpper = recipientRoles[0].toUpperCase();

        // Sender is platform-level (Super/Platform Admin)
        if (senderRole === Role.SUPER_ADMIN || senderRole === Role.PLATFORM_ADMIN) {
            if (recipientUpper === Role.ORG_ADMIN) {
                base = [...PLATFORM_TO_ORG_CATEGORIES, ...UNIVERSAL_CATEGORIES];
            } else {
                base = [...PLATFORM_CATEGORIES, ...UNIVERSAL_CATEGORIES];
            }
        }
        // Sender is org-level admin/manager
        else if (senderRole === Role.ORG_ADMIN || senderRole === Role.ORG_MANAGER) {
            if (recipientUpper === Role.SUPER_ADMIN || recipientUpper === Role.PLATFORM_ADMIN) {
                base = [...PLATFORM_CATEGORIES, ...UNIVERSAL_CATEGORIES];
            } else {
                base = [...ORG_ADMIN_TO_STAFF_CATEGORIES, ...UNIVERSAL_CATEGORIES];
            }
        }
        // Sender is a teacher
        else if (senderRole === Role.TEACHER) {
            base = [...TEACHER_CATEGORIES, ...UNIVERSAL_CATEGORIES];
        }
    }

    // Unique by value
    const seen = new Set();
    return base.filter(c => {
        if (seen.has(c.value)) return false;
        seen.add(c.value);
        return true;
    });
}

const PRIORITIES = [
    { value: 'LOW', label: 'Low' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'HIGH', label: 'High' },
    { value: 'URGENT', label: 'Urgent' },
];

export function NewMailModal({
    isOpen,
    onClose,
    onSuccess,
    initialTargetId,
    initialSubject
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

    const selectedTargets = useMemo(
        () => targets.filter(t => targetIds.includes(t.id)),
        [targets, targetIds]
    );

    const isPlatformAdmin = user?.role === Role.PLATFORM_ADMIN || user?.role === Role.SUPER_ADMIN;
    const primaryTarget = selectedTargets[0];
    const isTargetingPlatform = selectedTargets.some(t => t.role === Role.PLATFORM_ADMIN || t.role === Role.SUPER_ADMIN);
    const showNoReply = (isPlatformAdmin || user?.role === Role.ORG_ADMIN || user?.role === Role.ORG_MANAGER) &&
        !(user?.role !== Role.SUPER_ADMIN && user?.role !== Role.PLATFORM_ADMIN && isTargetingPlatform);

    const orgData: Record<string, string> = isPlatformAdmin ? {
        name: primaryTarget?.label || 'User',
        id: primaryTarget?.id || 'ID',
        admin: user?.name || 'Administrator',
        role: user?.role || 'Platform Admin',
        date: new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
        signature: 'EduVerse Support'
    } : {};

    // Fetch contactable users when modal opens
    React.useEffect(() => {
        if (isOpen && token) {
            setSearching(true);
            api.mail.getContactableUsers(token)
                .then(data => {
                    setTargets(data);
                    if (initialTargetId) {
                        // Call the handler to ensure categories etc. are updated
                        handleTargetChange(initialTargetId, data);
                    }
                    if (initialSubject) setSubject(initialSubject);
                })
                .catch(console.error)
                .finally(() => setSearching(false));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, token, initialTargetId, initialSubject]);

    React.useEffect(() => {
        if (error || info) {
            const timer = setTimeout(() => {
                setError('');
                setInfo('');
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [error, info]);

    // Compute context-aware categories based on the FIRST selected target
    const availableCategories = useMemo(
        () => getCategoriesForContext(user?.role as Role | undefined, selectedTargets.map(t => t.role || '')),
        [user?.role, selectedTargets]
    );

    // When recipients change, auto-reset category to first valid option if needed
    const handleTargetChange = React.useCallback((newTargetIds: string | string[], overrideTargets?: MailTarget[]) => {
        const currentTargets = overrideTargets || targets;
        const incomingIds = typeof newTargetIds === 'string' ? [newTargetIds] : newTargetIds;
        const addedIds = incomingIds.filter(id => !targetIds.includes(id));
        let finalIds = [...incomingIds];
        let feedback = '';

        const MEGA_GROUPS = ['ROLE:ORG_STAFF', 'ROLE:PLATFORM_ADMIN'];

        for (const addedId of addedIds) {
            const addedTarget = currentTargets.find(t => t.id === addedId);
            if (!addedTarget) continue;

            const activeTargetsList = currentTargets.filter(t => finalIds.includes(t.id));

            // 1. Mega Group Exclusivity (All Staff / Platform Team)
            if (activeTargetsList.length > 1 && MEGA_GROUPS.includes(addedId)) {
                finalIds = [addedId];
                feedback = `Targeting ${addedTarget.label} cancels all other selections.`;
                break;
            }

            // 2. If something else is added while a Mega Group is present, remove the Mega Group
            const activeMegaGroup = finalIds.find(id => MEGA_GROUPS.includes(id) && id !== addedId);
            if (activeMegaGroup) {
                finalIds = finalIds.filter(id => !MEGA_GROUPS.includes(id));
            }

            // 3. Regular Group vs Sub-Group / User Exclusivity
            if (addedTarget.type === 'ROLE') {
                if (addedTarget.role === Role.TEACHER || addedTarget.role === Role.ORG_MANAGER) {
                    finalIds = finalIds.filter(id => id !== 'ROLE:ORG_STAFF');
                }

                // Unselect individual users of that role
                finalIds = finalIds.filter(id => {
                    if (id === addedId) return true;
                    const t = currentTargets.find(x => x.id === id);
                    if (t?.type === 'USER' && t.role === addedTarget.role) return false;
                    return true;
                });
            } else if (addedTarget.type === 'USER') {
                const groupSelected = finalIds.some(id => {
                    const t = currentTargets.find(x => x.id === id);
                    return t?.type === 'ROLE' && t.role === addedTarget.role;
                });

                if (groupSelected) {
                    finalIds = finalIds.filter(id => id !== addedId);
                    feedback = `User ${addedTarget.label} is already included in the selected group.`;
                }
            }
        }

        if (feedback) setInfo(feedback);
        else setInfo('');

        setError('');

        setTargetIds(finalIds);
        const newTargets = currentTargets.filter(t => finalIds.includes(t.id));
        const newCategories = getCategoriesForContext(user?.role as Role | undefined, newTargets.map(t => t.role || ''));

        if (!newCategories.some(c => c.value === category)) {
            setCategory(newCategories[0]?.value || MailCategory.GENERAL_INQUIRY);
        }
    }, [targets, targetIds, user?.role, category]);



    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            const validFiles = filesArray.filter(file =>
                file.type.startsWith('image/') || file.type === 'application/pdf'
            );

            if (validFiles.length < filesArray.length) {
                setError('Only images and PDF files are allowed');
            }

            setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 5));
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            setError('Subject and message are required');
            return;
        }
        if (targetIds.length === 0) {
            setError('Please select at least one recipient');
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

            // Separate Roles from individual User IDs
            const roleTarget = selectedTargets.find(t => t.type === 'ROLE');
            const individualIds = selectedTargets.filter(t => t.type === 'USER').map(t => t.id);

            const response = await api.mail.createMail({
                subject,
                category: category as MailCategory,
                priority,
                message,
                assigneeIds: individualIds.length > 0 ? individualIds : undefined,
                targetRole: roleTarget?.role || undefined,
                noReply
            }, token);

            if (selectedFiles.length > 0) {
                const messageId = response.messages?.[0]?.id;
                const orgId = response.organizationId || 'SYSTEM';

                if (messageId) {
                    await Promise.all(
                        selectedFiles.map(file =>
                            api.files.uploadFile(orgId, 'MAIL_MESSAGE', messageId, file, token)
                        )
                    );
                }
            }

            setSubject('');
            setCategory(MailCategory.GENERAL_INQUIRY);
            setPriority('NORMAL');
            setMessage('');
            setTargetIds([]);
            setSelectedFiles([]);
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send mail');
        } finally {
            setSubmitting(false);
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'new-mail-submit' });
        }
    };

    return (
        <ModalForm
            isOpen={isOpen}
            onClose={onClose}
            title="Compose Mail"
            onSubmit={handleSubmit}
            submitText="Send Mail"
            isSubmitting={submitting}
            loadingId="new-mail-submit"
            maxWidth="max-w-7xl"
            feedback={
                error ? (
                    <div className="flex items-center gap-3 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger animate-shake">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p className="text-[11px] font-bold tracking-wider">{error}</p>
                    </div>
                ) : info ? (
                    <div className="flex items-center gap-3 p-3 bg-info/10 border border-info/20 rounded-lg text-info animate-in fade-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4 shrink-0 opacity-70" />
                        <p className="text-[11px] font-bold tracking-wider">{info}</p>
                    </div>
                ) : null
            }
        >
            <div>
                <div className="grid grid-cols-1 gap-3">
                    {/* Left Column: Basic Info */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-black text-muted-foreground tracking-widest mb-3">Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Explain your issue briefly"
                                className="w-full px-5 py-4 rounded-2xl bg-card/5 border border-border focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground font-bold text-base"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black text-muted-foreground tracking-widest mb-3">Recipients</label>
                            <CustomMultiSelect
                                values={targetIds}
                                onChange={handleTargetChange}
                                options={targets.map(t => ({
                                    value: t.id,
                                    label: t.type === 'ROLE' ? `[GROUP] ${t.label}` : t.label,
                                    icon: t.type === 'ROLE' ? Users : User
                                }))}
                                className="w-full"
                                placeholder={searching ? "Loading recipients..." : "Select one or more recipients..."}
                            />
                            {targetIds.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {selectedTargets.map(t => (
                                        <div key={t.id} className="text-[10px] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg tracking-wider block">
                                            {t.type === 'USER'
                                                ? `User: ${t.email} - ${t.role?.replace('_', ' ')} - ${t.description}`
                                                : `Group: ${t.label} - ${t.description}`
                                            }
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-muted-foreground tracking-widest mb-3">Category</label>
                                <CustomSelect
                                    value={category}
                                    onChange={(val) => setCategory(val)}
                                    options={availableCategories}
                                    className="w-full"
                                    placeholder="Select category"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-muted-foreground tracking-widest mb-3">Priority</label>
                                <CustomSelect
                                    value={priority}
                                    onChange={(val) => setPriority(val)}
                                    options={PRIORITIES}
                                    className="w-full"
                                    placeholder="Select priority"
                                />
                            </div>
                            {/* No Reply Option for Admins/Managers */}
                            {showNoReply && (
                                <div
                                    className="px-4 py-3 select-none hover:bg-card border border-border cursor-pointer rounded-2xl mt-3"
                                    onClick={() => setNoReply(!noReply)}
                                >
                                    <Toggle
                                        checked={noReply}
                                        onCheckedChange={setNoReply}
                                        label="No Reply"
                                        description="Recipients cannot reply to this mail"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Message & Files */}
                    <div className="space-y-6 flex flex-col h-full">
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-black text-muted-foreground tracking-widest">Attachments</label>
                                <span className="text-[10px] font-black text-primary bg-primary/20 px-2 py-0.5 rounded-full">{selectedFiles.length} / 5</span>
                            </div>

                            <div className="flex flex-wrap gap-2 min-h-11 p-3 bg-card/5 border border-dashed border-border rounded-lg">
                                {selectedFiles.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-card border border-border pl-3 pr-2 py-1.5 rounded-lg shadow-sm animate-in fade-in zoom-in duration-200">
                                        <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                            {file.type.startsWith('image/') ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                        </div>
                                        <span className="text-[11px] font-bold text-foreground max-w-25 truncate select-none">{file.name}</span>
                                        <button type="button" onClick={() => removeFile(i)} className="p-1 text-muted-foreground hover:text-dangerhover:bg-ddanger0 rounded-full transition-colors ml-1">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}

                                {selectedFiles.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-8.5 flex items-center gap-2 px-4 border border-dashed border-border rounded-2xl text-muted-foreground hover:border-primary hover:text-primary hover:bg-card/80 transition-all group"
                                    >
                                        <Paperclip className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-black tracking-wider">Add File</span>
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

                        <div className="flex-1">
                            <label className="block text-xs font-black text-muted-foreground tracking-widest mb-3">Detailed Message</label>
                            <MarkdownEditor
                                value={message}
                                onChange={setMessage}
                                placeholder="Describe your issue in detail..."
                                rows={8}
                                templates={isPlatformAdmin ? ADMIN_REPLY_TEMPLATES.map(t => ({ label: t.name, content: t.content })) : []}
                                orgData={orgData}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </ModalForm>
    );
}
