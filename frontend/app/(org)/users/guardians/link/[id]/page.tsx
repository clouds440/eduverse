'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { CheckCircle2, Loader2, Search, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { matchesCacheKeyPrefix } from '@/lib/swr';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { GuardianProfile, Role, Student, StudentStatus } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { BrandIcon } from '@/components/ui/Brand';

export default function LinkGuardianStudentsPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();
    const params = useParams();
    const guardianId = params.id as string;
    const listHref = '/users/guardians';
    const hasAccess = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [relationships, setRelationships] = useState<Record<string, string>>({});
    const [initialized, setInitialized] = useState(false);

    const guardianKey = token && guardianId && hasAccess ? ['guardian', guardianId] as const : null;
    const { data: guardian, isLoading: guardianLoading, error: guardianError } = useSWR<GuardianProfile>(
        guardianKey,
        ([, id]) => api.org.getGuardian(id as string, token!)
    );
    const normalizedSearch = search.trim();
    const canSearchStudents = normalizedSearch.length >= 2;
    const { data: studentsData, isLoading: studentsLoading, error: studentsError } = useSWR(
        token && hasAccess && canSearchStudents ? ['students', { page: 1, limit: 25, search: normalizedSearch, status: `${StudentStatus.ACTIVE},${StudentStatus.SUSPENDED}` }] as const : null,
        () => api.org.getStudents(token!, { page: 1, limit: 25, search: normalizedSearch, status: `${StudentStatus.ACTIVE},${StudentStatus.SUSPENDED}` })
    );

    const students = useMemo(() => {
        const merged = new Map<string, Student>();
        (guardian?.students || []).forEach((student) => merged.set(student.id, student));
        (studentsData?.data || []).forEach((student) => merged.set(student.id, student));
        return Array.from(merged.values());
    }, [guardian?.students, studentsData?.data]);
    const linkedStudentIds = useMemo(() => new Set((guardian?.students || []).map((student) => student.id)), [guardian?.students]);

    useEffect(() => {
        if (!guardian || initialized) return;
        const nextSelected = new Set<string>();
        const nextRelationships: Record<string, string> = {};
        (guardian.students || []).forEach((student) => {
            nextSelected.add(student.id);
            nextRelationships[student.id] = student.guardianRelationship || '';
        });
        setSelectedIds(nextSelected);
        setRelationships(nextRelationships);
        setInitialized(true);
    }, [guardian, initialized]);

    const toggleStudent = (student: Student) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(student.id)) {
                next.delete(student.id);
            } else {
                next.add(student.id);
                setRelationships((currentRelationships) => ({
                    ...currentRelationships,
                    [student.id]: currentRelationships[student.id] || student.guardianRelationship || '',
                }));
            }
            return next;
        });
    };

    const saveLinks = async () => {
        if (!token || !guardian) return;
        const selected = Array.from(selectedIds);
        const missingRelationship = selected.find((studentId) => !relationships[studentId]?.trim());
        if (missingRelationship) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Enter a relationship for each selected student.', type: 'error' } });
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'guardian-link-students' });
        try {
            const existingLinkedIds = new Set((guardian.students || []).map((student) => student.id));
            const updates: Promise<unknown>[] = [];

            selected.forEach((studentId) => {
                updates.push(api.org.updateStudent(studentId, {
                    guardianId,
                    guardianRelationship: relationships[studentId].trim(),
                }, token));
            });

            existingLinkedIds.forEach((studentId) => {
                if (!selectedIds.has(studentId)) {
                    updates.push(api.org.updateStudent(studentId, {
                        guardianId: '',
                        guardianRelationship: '',
                    }, token));
                }
            });

            await Promise.all(updates);
            mutate(matchesCacheKeyPrefix('guardians'));
            mutate(matchesCacheKeyPrefix('guardian'));
            mutate(matchesCacheKeyPrefix('students'));
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Guardian student links updated.', type: 'success' } });
            router.push(listHref);
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Failed to update guardian links', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'guardian-link-students' });
        }
    };

    if (!hasAccess) {
        return (
            <PageShell>
                <EmptyState icon={Users} title="Access restricted" description="Guardian linking is available to Admin and Sub Admin accounts." />
            </PageShell>
        );
    }

    if (guardianLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-primary-foreground/60">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-bold tracking-widest">Loading Student Links...</p>
                </div>
            </div>
        );
    }

    if (guardianError || studentsError) {
        return (
            <PageShell>
                <ErrorState error={guardianError || studentsError} />
            </PageShell>
        );
    }

    if (!guardian) return null;

    return (
        <PageShell>
            <PageHeader
                title="Link Students"
                description={guardian.user?.name || guardian.user?.email}
                icon={Users}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Users', href: '/users' },
                    { label: 'Guardians', href: listHref },
                    { label: 'Link Students' },
                ]}
                meta={<Badge variant="primary" size="sm">{selectedIds.size} selected</Badge>}
            />

            <ResourcePanel className="overflow-hidden">
                <div className="shrink-0 border-b border-border/60 bg-card/90 p-3 sm:p-4">
                    <Input
                        icon={Search}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search students by name, email, roll number, or batch"
                    />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                    <div className="grid gap-3 lg:grid-cols-2">
                        {students.map((student: Student) => {
                            const selected = selectedIds.has(student.id);
                            const linkedHere = linkedStudentIds.has(student.id);
                            const linkedElsewhere = Boolean(student.guardianId && student.guardianId !== guardian.id);
                            return (
                                <section
                                    key={student.id}
                                    className={`rounded-lg border p-3 transition-colors ${selected ? 'border-primary/45 bg-primary/5' : 'border-border/70 bg-card/70'}`}
                                >
                                    <div className="flex min-w-0 items-start gap-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleStudent(student)}
                                            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-transparent'}`}
                                            aria-pressed={selected}
                                            aria-label={selected ? 'Unselect student' : 'Select student'}
                                        >
                                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                        <BrandIcon variant="user" user={student.user} size="sm" className="h-10 w-10" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                <h2 className="truncate text-sm font-black text-foreground">{student.user?.name || 'Student'}</h2>
                                                {linkedHere && <Badge variant="success" size="sm">Linked</Badge>}
                                                {linkedElsewhere && <Badge variant="warning" size="sm">Has Guardian</Badge>}
                                            </div>
                                            <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{student.user?.email}</p>
                                            <p className="mt-1 text-xs font-bold text-muted-foreground">
                                                Roll {student.rollNumber || '-'} · Reg {student.registrationNumber || '-'}
                                            </p>
                                        </div>
                                    </div>
                                    {selected && (
                                        <div className="mt-3">
                                            <Input
                                                value={relationships[student.id] || ''}
                                                onChange={(event) => setRelationships((current) => ({ ...current, [student.id]: event.target.value }))}
                                                placeholder="Relationship, e.g. Father, Mother, Uncle"
                                                className="h-11 border-border/60 bg-background/80 font-medium"
                                            />
                                        </div>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                    {studentsLoading && (
                        <div className="rounded-lg border border-border/70 bg-card/70 p-4 text-sm font-bold text-muted-foreground">
                            Searching students...
                        </div>
                    )}
                    {!studentsLoading && students.length === 0 && (
                        <EmptyState
                            icon={Users}
                            title={canSearchStudents ? 'No students found' : 'Search students'}
                            description={canSearchStudents ? 'Adjust the search term to find students.' : 'Type at least 2 characters to search active and suspended students.'}
                            className="min-h-80"
                        />
                    )}
                </div>
            </ResourcePanel>

            <div className="sticky bottom-3 z-20 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 px-3">
                        <p className="text-sm font-black text-foreground">Save student links</p>
                        <p className="text-xs font-semibold text-muted-foreground">{selectedIds.size} students selected for this guardian.</p>
                    </div>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                        <Button type="button" variant="secondary" onClick={() => router.push(listHref)} className="h-12 w-full px-6 text-sm font-semibold sm:w-auto">
                            Cancel
                        </Button>
                        <Button type="button" loadingId="guardian-link-students" loadingText="Saving..." className="h-12 w-full px-6 text-sm font-semibold sm:w-auto" icon={CheckCircle2} onClick={saveLinks}>
                            Done
                        </Button>
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
