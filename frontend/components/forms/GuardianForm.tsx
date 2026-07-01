'use client';

import { FormEvent, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, Home, Lock, Mail, Phone, ShieldCheck, User, User2, UserPlus, Users, UserX } from 'lucide-react';
import { mutate } from 'swr';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { CreateGuardianRequest, GuardianProfile, UpdateGuardianRequest, UserStatus } from '@/types';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { FormActions, FormField, FormGrid, FormSection, FORM_INPUT_CLASS, FORM_READONLY_INPUT_CLASS } from '@/components/ui/FormLayout';
import { PhotoUploadPicker } from '@/components/ui/PhotoUploadPicker';
import { Badge } from '@/components/ui/Badge';

interface GuardianFormProps {
    guardianId?: string;
    initialData?: GuardianProfile;
}

const USER_STATUS_OPTIONS = [
    { value: UserStatus.ACTIVE, label: 'Active', icon: ShieldCheck },
    { value: UserStatus.SUSPENDED, label: 'Suspended', icon: UserX },
    { value: UserStatus.ON_LEAVE, label: 'On Leave', icon: CalendarClock },
];

export default function GuardianForm({ guardianId, initialData }: GuardianFormProps) {
    const { token } = useAuth();
    const router = useRouter();
    const { dispatch } = useGlobal();
    const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
    const listHref = '/users/guardians';
    const studentListHref = '/users/students';
    const [form, setForm] = useState({
        name: initialData?.user?.name || '',
        email: initialData?.user?.email || '',
        password: '',
        status: initialData?.user?.status || UserStatus.ACTIVE,
        phone: initialData?.phone || initialData?.user?.phone || '',
        address: initialData?.address || '',
    });

    const linkedStudents = useMemo(() => initialData?.students || [], [initialData?.students]);

    const update = (key: keyof typeof form, value: string) => {
        setForm((current) => ({ ...current, [key]: value }));
    };

    const handlePhotoReady = useCallback((file: File) => {
        setPendingPhoto(file);
    }, []);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!token) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'guardian-submit' });
        try {
            const payload: CreateGuardianRequest | UpdateGuardianRequest = {
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim() || undefined,
                address: form.address.trim() || undefined,
                status: form.status as UserStatus,
                ...(guardianId
                    ? (form.password ? { password: form.password } : {})
                    : { password: form.password }),
            };

            const savedGuardian = guardianId
                ? await api.org.updateGuardian(guardianId, payload as UpdateGuardianRequest, token)
                : await api.org.createGuardian(payload as CreateGuardianRequest, token);

            if (pendingPhoto) {
                await api.org.uploadAvatar(savedGuardian.userId, pendingPhoto, token);
                setPendingPhoto(null);
            }

            mutate(matchesCacheKeyPrefix('guardians'));
            dispatch({ type: 'TOAST_ADD', payload: { message: `Guardian ${guardianId ? 'updated' : 'created'} successfully.`, type: 'success' } });
            router.push(listHref);
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Failed to save guardian', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'guardian-submit' });
        }
    };

    return (
        <form onSubmit={submit} className="space-y-6">
            <FormSection title="Guardian Account" description="Basic sign-in, status, contact, and profile photo." icon={User} bodyClassName="p-0">
                <div className="grid min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <aside className="border-b border-border/60 bg-background/35 p-5 lg:border-b-0 lg:border-r">
                        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/70 bg-card/80 p-4 text-center">
                            <PhotoUploadPicker
                                currentImageUrl={initialData?.user?.avatarUrl}
                                updatedAt={initialData?.user?.avatarUpdatedAt}
                                onFileReady={handlePhotoReady}
                                hint="Upload a square profile picture for this guardian."
                                type="user"
                            />
                            <div>
                                <p className="text-sm font-black text-foreground">{initialData?.user?.name || 'Guardian'}</p>
                                <p className="mt-1 text-xs font-semibold text-muted-foreground">{form.status}</p>
                            </div>
                        </div>
                    </aside>

                    <div className="space-y-5 p-4 sm:p-5">
                        <FormGrid>
                            <FormField label="Full Name" required>
                                <Input value={form.name} onChange={(event) => update('name', event.target.value)} icon={User} className={FORM_INPUT_CLASS} required />
                            </FormField>

                            <FormField label="Status">
                                <CustomSelect
                                    options={USER_STATUS_OPTIONS}
                                    value={form.status}
                                    onChange={(value) => update('status', value)}
                                    icon={form.status === UserStatus.SUSPENDED ? UserX : ShieldCheck}
                                />
                            </FormField>

                            <FormField label="Email" required>
                                <Input
                                    type="email"
                                    value={form.email}
                                    onChange={(event) => update('email', event.target.value)}
                                    icon={Mail}
                                    className={guardianId ? FORM_READONLY_INPUT_CLASS : FORM_INPUT_CLASS}
                                    disabled={!!guardianId}
                                    readOnly={!!guardianId}
                                    required
                                />
                            </FormField>

                            <FormField label="Temporary Password" required={!guardianId}>
                                <Input
                                    type="password"
                                    value={form.password}
                                    onChange={(event) => update('password', event.target.value)}
                                    icon={Lock}
                                    className={FORM_INPUT_CLASS}
                                    placeholder={guardianId ? 'Leave blank to keep current' : 'Min 8 chars, 1 upper, 1 lower, 1 num'}
                                    required={!guardianId}
                                />
                            </FormField>

                            <FormField label="Phone">
                                <Input value={form.phone} onChange={(event) => update('phone', event.target.value)} icon={Phone} className={FORM_INPUT_CLASS} />
                            </FormField>
                        </FormGrid>

                        <FormField label="Address">
                            <Textarea value={form.address} onChange={(event) => update('address', event.target.value)} icon={Home} className="min-h-24" />
                        </FormField>
                    </div>
                </div>
            </FormSection>

            {guardianId && (
                <FormSection title="Linking Students" description="Students connected to this guardian account. You can link here or from a student record." icon={Users}>
                    <div className="space-y-4">
                        <Link href={`${listHref}/link/${guardianId}`}>
                            <button
                                type="button"
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-black text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            >
                                <UserPlus className="h-4 w-4" aria-hidden="true" />
                                Link Students
                            </button>
                        </Link>
                        <div className="mt-3 border-t border-border/50">
                            <span className="flex text-muted-foreground text-sm mt-1">Linked Students:</span>
                            {linkedStudents.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {linkedStudents.map((student) => (
                                        <Badge key={student.id} variant="neutral" onClick={() => router.push(`${studentListHref}/edit/${student.id}`)}>
                                            <User2 className="h-3 w-3" aria-hidden="true" />
                                            {student.user?.name || student.rollNumber || 'Student'}
                                            {student.guardianRelationship ? ` - ${student.guardianRelationship}` : ''}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm font-semibold text-muted-foreground">No students are linked yet.</p>
                            )}
                        </div>
                    </div>
                </FormSection>
            )}

            <FormActions
                onCancel={() => router.push(listHref)}
                submitText={guardianId ? 'Update Guardian' : 'Create Guardian'}
                loadingId="guardian-submit"
                title="Save guardian account"
                description="Students can be linked from this guardian account or from the student form."
            />
        </form>
    );
}
