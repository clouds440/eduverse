'use client';

import { useState, useEffect, useCallback, memo, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    CheckCircle,
    Edit,
    FileText,
    Plus,
    Send,
    Trash2,
    Trophy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Assessment, Section, Role, AssessmentType } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useGlobal } from '@/context/GlobalContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import AssessmentForm from '@/components/forms/AssessmentForm';
import SubmissionForm from '@/components/forms/SubmissionForm';
import { formatDate } from '@/lib/utils';

interface AssessmentListProps {
    section: Section;
    role: Role;
}

function assessmentVariant(type: AssessmentType): 'primary' | 'warning' | 'info' {
    if (type === AssessmentType.FINAL) return 'primary';
    if (type === AssessmentType.MIDTERM) return 'warning';
    return 'info';
}

export default memo(function AssessmentList({ section, role }: AssessmentListProps) {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();

    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
    const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(null);
    const [submittingAssessment, setSubmittingAssessment] = useState<Assessment | null>(null);

    const isAssigned = section.teachers?.some((teacher) => teacher.user?.id === user?.id);
    const canCreate = (role === Role.TEACHER || role === Role.ORG_MANAGER) && isAssigned;
    const canView = role === Role.ORG_ADMIN || role === Role.ORG_MANAGER || role === Role.TEACHER;

    const fetchAssessments = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const data = await api.org.getAssessments(token, { sectionId: section.id });
            setAssessments(data);
        } catch (error) {
            console.error('Failed to fetch assessments:', error);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to load assessments', type: 'error' } });
        } finally {
            setIsLoading(false);
        }
    }, [token, section.id, dispatch]);

    useEffect(() => {
        fetchAssessments();
    }, [fetchAssessments]);

    const handleDelete = async () => {
        if (!token || !deletingAssessment) return;
        const target = deletingAssessment;

        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `assessment-delete-${target.id}` });
            await api.org.deleteAssessment(target.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Assessment deleted successfully', type: 'success' } });
            setAssessments((current) => current.filter((assessment) => assessment.id !== target.id));
            setDeletingAssessment(null);
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to delete assessment', type: 'error' } });
            setDeletingAssessment(null);
            console.error('Failed to delete assessment:', error);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `assessment-delete-${target.id}` });
        }
    };

    const openAssessment = (assessment: Assessment) => {
        router.push(`/sections/${section.id}/assessments/${assessment.id}`);
    };

    const handleAssessmentKeyDown = (event: KeyboardEvent<HTMLElement>, assessment: Assessment) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openAssessment(assessment);
    };

    if (isLoading) {
        return (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[...Array(3)].map((_, index) => (
                    <div key={index} className="h-40 min-w-0 animate-pulse rounded-lg border border-border/70 bg-muted/35" />
                ))}
            </div>
        );
    }

    return (
        <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-black text-foreground">{assessments.length} assessments</p>
                    <p className="break-words text-xs font-semibold text-muted-foreground">Sorted by the section workflow, opened in the grading detail page.</p>
                </div>
                {canCreate && (
                    <Button onClick={() => setIsCreateModalOpen(true)} icon={Plus} className="w-full sm:w-auto">
                        Add Assessment
                    </Button>
                )}
            </div>

            {assessments.length === 0 ? (
                <div className="min-w-0 rounded-lg border border-dashed border-border/70 bg-background/60 px-4 py-10 text-center sm:px-6">
                    <FileText className="mx-auto h-9 w-9 text-muted-foreground/45" />
                    <p className="mt-3 text-sm font-black text-foreground">No assessments yet</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">Create an assessment when this section is ready for grading.</p>
                </div>
            ) : (
                <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {assessments.map((assessment) => {
                        const dueLabel = assessment.dueDate ? formatDate(assessment.dueDate) : 'No due date';
                        const dueDatePassed = Boolean(assessment.dueDate && new Date(assessment.dueDate) < new Date());

                        return (
                            <article
                                key={assessment.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => openAssessment(assessment)}
                                onKeyDown={(event) => handleAssessmentKeyDown(event, assessment)}
                                className="group min-w-0 max-w-full cursor-pointer overflow-hidden rounded-lg border border-border/70 bg-card p-3 shadow-sm transition-colors hover:border-primary/35 hover:bg-background/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:p-4"
                            >
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                    <Badge variant={assessmentVariant(assessment.type)} size="sm">
                                        {assessment.type}
                                    </Badge>
                                    {canCreate && (
                                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={() => setEditingAssessment(assessment)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                                aria-label={`Edit ${assessment.title}`}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeletingAssessment(assessment)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-danger/25 text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                                                aria-label={`Delete ${assessment.title}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 min-w-0">
                                    <h3 className="line-clamp-2 break-words text-base font-black leading-tight text-foreground group-hover:text-primary">
                                        {assessment.title}
                                    </h3>
                                    <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 min-[520px]:grid-cols-3">
                                        <div className="min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Marks</p>
                                            <p className="mt-1 text-sm font-black text-foreground">{assessment.totalMarks}</p>
                                        </div>
                                        <div className="min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Weight</p>
                                            <p className="mt-1 text-sm font-black text-foreground">{assessment.weightage}%</p>
                                        </div>
                                        <div className="min-w-0 overflow-hidden rounded-md border border-border/60 bg-background/70 p-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due</p>
                                            <p className="mt-1 truncate text-sm font-black text-foreground">{dueLabel}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex min-w-0 flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="inline-flex min-w-0 flex-wrap items-center gap-2 text-xs font-black text-muted-foreground">
                                        <Trophy className="h-4 w-4 text-primary" />
                                        {canView ? 'Open grading' : 'Open details'}
                                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                    </span>

                                    {role === Role.STUDENT && (
                                        assessment.allowSubmissions ? (
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                icon={Send}
                                                disabled={dueDatePassed}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSubmittingAssessment(assessment);
                                                }}
                                            >
                                                Submit
                                            </Button>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                icon={CheckCircle}
                                                loadingId={`assessment-submit-${assessment.id}`}
                                                disabled={dueDatePassed}
                                                onClick={async (event) => {
                                                    event.stopPropagation();
                                                    try {
                                                        dispatch({ type: 'UI_START_PROCESSING', payload: `assessment-submit-${assessment.id}` });
                                                        await api.org.createSubmission(assessment.id, { assessmentId: assessment.id }, token!);
                                                        dispatch({ type: 'TOAST_ADD', payload: { message: 'Marked as done', type: 'success' } });
                                                    } catch (error) {
                                                        dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to mark as done', type: 'error' } });
                                                        console.error('Failed to mark as done:', error);
                                                    } finally {
                                                        dispatch({ type: 'UI_STOP_PROCESSING', payload: `assessment-submit-${assessment.id}` });
                                                    }
                                                }}
                                            >
                                                Done
                                            </Button>
                                        )
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="New Assessment"
                subtitle={`${section.name} - ${section.course?.name}`}
                maxWidth="max-w-3xl"
            >
                <AssessmentForm
                    sectionId={section.id}
                    courseId={section.courseId!}
                    onSuccess={(assessment) => {
                        setAssessments((current) => [...current, assessment]);
                        setIsCreateModalOpen(false);
                    }}
                    onCancel={() => setIsCreateModalOpen(false)}
                />
            </Modal>

            <Modal
                isOpen={!!editingAssessment}
                onClose={() => setEditingAssessment(null)}
                title="Edit Assessment"
                subtitle={editingAssessment ? `Updating: ${editingAssessment.title}` : ''}
                maxWidth="max-w-2xl"
            >
                {editingAssessment && (
                    <AssessmentForm
                        sectionId={section.id}
                        courseId={section.courseId!}
                        assessmentId={editingAssessment.id}
                        initialData={editingAssessment}
                        onSuccess={(assessment) => {
                            setAssessments((current) => current.map((item) => item.id === assessment.id ? assessment : item));
                            setEditingAssessment(null);
                        }}
                        onCancel={() => setEditingAssessment(null)}
                    />
                )}
            </Modal>

            <Modal
                isOpen={!!submittingAssessment}
                onClose={() => setSubmittingAssessment(null)}
                title="Submit Work"
                subtitle={submittingAssessment ? submittingAssessment.title : ''}
                maxWidth="max-w-2xl"
            >
                {submittingAssessment && (
                    <SubmissionForm
                        assessmentId={submittingAssessment.id}
                        onSuccess={() => setSubmittingAssessment(null)}
                        onCancel={() => setSubmittingAssessment(null)}
                    />
                )}
            </Modal>

            <ConfirmDialog
                isOpen={!!deletingAssessment}
                onClose={() => setDeletingAssessment(null)}
                onConfirm={handleDelete}
                title="Delete Assessment"
                description={`Are you sure you want to delete "${deletingAssessment?.title}"? This will also remove all associated grades and submissions.`}
                confirmText="Delete Assessment"
                isDestructive={true}
                loadingId={deletingAssessment ? `assessment-delete-${deletingAssessment.id}` : undefined}
            />
        </div>
    );
});
