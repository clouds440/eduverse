'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    Plus,
    Calendar,
    Trophy,
    Users,
    FileText,
    Trash2,
    Edit,
    Send,
    CheckCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Assessment, Section, Role, AssessmentType } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import AssessmentForm from '@/components/forms/AssessmentForm';
import SubmissionForm from '@/components/forms/SubmissionForm';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';

interface AssessmentListProps {
    section: Section;
    role: Role;
}

export default memo(function AssessmentList({ section, role }: AssessmentListProps) {
    const { token } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();

    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
    const [deletingAssessment, setDeletingAssessment] = useState<Assessment | null>(null);
    const [submittingAssessment, setSubmittingAssessment] = useState<Assessment | null>(null);

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
        try {
            dispatch({ type: 'UI_START_PROCESSING', payload: `assessment-delete-${deletingAssessment.id}` });
            await api.org.deleteAssessment(deletingAssessment.id, token);
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Assessment deleted successfully', type: 'success' } });
            setAssessments(prev => prev.filter(a => a.id !== deletingAssessment.id));
            setDeletingAssessment(null);
        } catch (error) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to delete assessment', type: 'error' } });
            setDeletingAssessment(null);
            console.error('Failed to delete assessment:', error);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: `assessment-delete-${deletingAssessment.id}` });
        }
    };

    const { user } = useAuth();
    const isAssigned = section.teachers?.some(t => t.user?.id === user?.id);
    const canCreate = (role === Role.TEACHER || role === Role.ORG_MANAGER) && isAssigned;
    const canView = role === Role.ORG_ADMIN || role === Role.ORG_MANAGER || role === Role.TEACHER;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center">
                {canCreate && (
                    <Button onClick={() => setIsCreateModalOpen(true)} icon={Plus}>
                        Add Assessment
                    </Button>
                )}
            </div>

            {assessments.length === 0 ? (
                <div className="bg-primary/5 border border-dashed border-border rounded-xl p-12 text-center">
                    <FileText className="w-12 h-12 text-card-text/20 mx-auto mb-4" />
                    <p className="text-card-text/40 font-bold tracking-widest text-xs">No assessments created for this section yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {assessments.map(assessment => {
                        const targetUrl = `/sections/${section.id}/assessments/${assessment.id}`;

                        return (
                            <Card
                                key={assessment.id}
                                onClick={() => router.push(targetUrl)}
                                accentColor={assessment.type === AssessmentType.FINAL ? 'bg-primary' : assessment.type === AssessmentType.MIDTERM ? 'bg-warning' : 'bg-info'}
                                padding="lg"
                            >
                                <CardHeader>
                                    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-[0.15em] border-2 shadow-sm ${assessment.type === AssessmentType.FINAL ? 'bg-primary/10 text-primary border-primary/30' :
                                        assessment.type === AssessmentType.MIDTERM ? 'bg-warning/10 text-warning border-warning/30' :
                                            'bg-primary/5 text-primary border-primary/10'
                                        }`}>
                                        {assessment.type}
                                    </div>
                                    {canCreate && (
                                        <div className="flex gap-2 opacity-40 group-hover:opacity-100 transition-all duration-300">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingAssessment(assessment);
                                                }}
                                                className="p-2.5 text-muted hover:text-primary transition-all hover:bg-primary/10 rounded-xl border border-transparent hover:border-primary bg-foreground shadow-xs"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeletingAssessment(assessment);
                                                }}
                                                className="p-2.5 text-danger hover:text-danger/80 transition-all hover:bg-danger/50 rounded-xl border border-transparent hover:border-danger bg-foreground shadow-xs"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </CardHeader>

                                <CardContent>
                                    <h4 className="text-xl font-black text-foreground leading-tight tracking-tight group-hover:text-primary transition-colors duration-300">{assessment.title}</h4>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted font-bold tracking-widest pt-2">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 rounded-full border border-primary">
                                            <Trophy className="w-4 h-4 text-primary/70" />
                                            <span>{assessment.totalMarks} Marks</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 rounded-full border border-primary">
                                            <Calendar className="w-4 h-4 text-primary/70" />
                                            <span>{assessment.dueDate ? formatDate(assessment.dueDate) : 'No due date'}</span>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black tracking-[0.2em] text-muted">Weightage</span>
                                        <span className="text-xl font-black text-primary leading-none">{assessment.weightage}%</span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="h-10 px-6 text-[11px] font-black tracking-widest gap-2 flex items-center justify-center bg-background text-foreground group-hover:text-white rounded-xl shadow-lg group-hover:bg-primary group-hover:shadow-primary/50 transition-all duration-300">
                                            {canView ? (
                                                <><Users className="w-4 h-4" /> View Grades</>
                                            ) : (
                                                <><FileText className="w-4 h-4" /> View Details</>
                                            )}
                                        </div>

                                        {role === Role.STUDENT && (
                                            assessment.allowSubmissions ? (
                                                <Button
                                                    variant="primary"
                                                    className="h-10 px-6 text-[11px] font-black gap-2 rounded-xl shadow-lg"
                                                    disabled={!!(assessment.dueDate && new Date(assessment.dueDate) < new Date())}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSubmittingAssessment(assessment);
                                                    }}
                                                >
                                                    <Send className="w-4 h-4" />
                                                    Submit
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    className="h-10 px-6 text-[11px] font-black gap-2 rounded-xl shadow-md"
                                                    loadingId={`assessment-submit-${assessment.id}`}
                                                    disabled={!!(assessment.dueDate && new Date(assessment.dueDate) < new Date())}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            dispatch({ type: 'UI_START_PROCESSING', payload: `assessment-submit-${assessment.id}` });
                                                            await api.org.createSubmission(assessment.id, { assessmentId: assessment.id }, token!);
                                                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Marked as done', type: 'success' } });
                                                        } catch (e) {
                                                            dispatch({ type: 'TOAST_ADD', payload: { message: 'Failed to mark as done', type: 'error' } });
                                                            console.error('Failed to mark as done:', e);
                                                        } finally {
                                                            dispatch({ type: 'UI_STOP_PROCESSING', payload: `assessment-submit-${assessment.id}` });
                                                        }
                                                    }}
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Done
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="New Assessment"
                subtitle={`${section.name} • ${section.course?.name}`}
                maxWidth="max-w-3xl"
            >
                <AssessmentForm
                    sectionId={section.id}
                    courseId={section.courseId!}
                    onSuccess={(a) => {
                        setAssessments(prev => [...prev, a]);
                        setIsCreateModalOpen(false);
                    }}
                    onCancel={() => setIsCreateModalOpen(false)}
                />
            </Modal>

            {/* Edit Modal */}
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
                        onSuccess={(a) => {
                            setAssessments(prev => prev.map(item => item.id === a.id ? a : item));
                            setEditingAssessment(null);
                        }}
                        onCancel={() => setEditingAssessment(null)}
                    />
                )}
            </Modal>

            {/* Submission Modal */}
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

