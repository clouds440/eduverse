'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Users, Calendar, CheckCircle2, Link as LinkIcon, Download } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { Assessment, Section, Grade, Submission, Role, GradeStatus } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { useParams } from 'next/navigation';
import { formatDate, getPublicUrl, formatBytes } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { Modal } from '@/components/ui/Modal';
import GradingForm from '@/components/forms/GradingForm';
import { BulkGradingModal } from '@/components/forms/BulkGradingModal';
import { BrandIcon } from '@/components/ui/Brand';
import { NotFound } from '@/components/NotFound';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton';

function AssessmentAuditSkeleton() {
    return (
        <>
            <ResourcePanel className="flex-none overflow-hidden">
                <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Skeleton className="h-6 w-24 rounded-md" />
                            <Skeleton className="h-6 w-40 rounded-md" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Skeleton className="h-20 rounded-lg" />
                            <Skeleton className="h-20 rounded-lg" />
                            <Skeleton className="h-20 rounded-lg" />
                        </div>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-3 lg:w-92 lg:grid-cols-1">
                        <Skeleton className="h-14 rounded-lg" />
                        <Skeleton className="h-14 rounded-lg" />
                        <Skeleton className="h-14 rounded-lg" />
                    </div>
                </div>
            </ResourcePanel>

            <ResourcePanel className="overflow-hidden">
                <div className="space-y-4 border-b border-border/60 bg-primary/5 p-4 sm:p-6">
                    <Skeleton className="h-20 rounded-lg" />
                    <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-7 w-72 max-w-full" />
                        <Skeleton className="h-10 w-28 rounded-md" />
                    </div>
                </div>
                <div className="min-h-0 flex-1 p-3">
                    <SkeletonTable rows={6} columns={7} className="border-0" />
                </div>
            </ResourcePanel>
        </>
    );
}

export default function AssessmentDetailPage() {
    const { token, user } = useAuth();
    const role = user?.role;
    const userId = user?.id;
    const params = useParams();
    const { dispatch } = useGlobal();

    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [showBulkGrading, setShowBulkGrading] = useState(false);

    const sectionId = params.id as string;
    const assessmentId = params.assessmentId as string;

    // SWR for assessment detail - composite key with parallel fetching
    const assessmentKey = token && sectionId && assessmentId
        ? ['assessment-detail', sectionId, assessmentId] as const
        : null;
    const { data: assessmentData, isLoading } = useSWR<{
        assessment: Assessment;
        section: Section;
        grades: Grade[];
        submissions: Submission[];
    }>(assessmentKey);

    const assessment = assessmentData?.assessment || null;
    const section = assessmentData?.section || null;
    const grades = assessmentData?.grades || [];
    const submissions = assessmentData?.submissions || [];
    const resourceExists = assessmentData ? true : (isLoading ? null : false);

    const isAssigned = section?.teachers?.some(t => t.user?.id === userId);
    const canGrade = (role === Role.TEACHER || role === Role.ORG_MANAGER) && isAssigned;
    const isTeacherOrAdmin = role === Role.TEACHER || role === Role.ORG_ADMIN || role === Role.SUB_ADMIN || role === Role.ORG_MANAGER;
    const safeAssessmentExternalLink = normalizeSafeUrl(assessment?.externalLink, { allowRelative: false });

    const isInitialLoading = isLoading && !assessmentData;

    if (resourceExists === false) {
        return <NotFound page="Assessment" />;
    }

    if (!isInitialLoading && (!assessment || !section)) return null;

    const headerTitle = assessment?.title || 'Assessment Audit';
    const headerDescription = assessment
        ? 'Review submissions, grade status, marks, and transcript readiness for this assessment.'
        : 'Loading assessment grades, submissions, and audit details.';

    return (
        <PageShell className="overflow-x-hidden overflow-y-auto custom-scrollbar">
            <PageHeader
                title={headerTitle}
                description={headerDescription}
                icon={Trophy}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Sections', href: '/sections' },
                    { label: section ? <CourseSectionLabel section={section} /> : 'Section' },
                    { label: 'Audit' },
                ]}
                meta={assessment && section ? (
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant="primary" size="sm">{assessment.type}</Badge>
                        <Badge variant="neutral" size="sm"><CourseSectionLabel section={section} /></Badge>
                    </div>
                ) : undefined}
            />

            {isInitialLoading ? (
                <AssessmentAuditSkeleton />
            ) : assessment && section ? (
                <>
                    <ResourcePanel className="flex-none overflow-hidden">
                        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Badge variant="primary" size="sm">{assessment.type}</Badge>
                                    <Badge variant="neutral" size="sm"><CourseSectionLabel section={section} /></Badge>
                                </div>
                                <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-3">
                                    <div className="min-w-0 rounded-lg border border-border/70 bg-background/60 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Marks</p>
                                        <p className="mt-2 text-2xl font-black text-primary">{assessment.totalMarks}</p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-border/70 bg-background/60 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Weightage</p>
                                        <p className="mt-2 text-2xl font-black text-foreground">{assessment.weightage}%</p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-border/70 bg-background/60 p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due Date</p>
                                        <p className="mt-2 truncate text-sm font-black text-foreground">{assessment.dueDate ? formatDate(assessment.dueDate) : 'No Due Date'}</p>
                                    </div>
                                </div>
                            </div>

                            {(safeAssessmentExternalLink || (assessment.files && assessment.files.length > 0)) && (
                                <div className="grid min-w-0 content-start gap-2 lg:w-92">
                                    {safeAssessmentExternalLink && (
                                        <a
                                            href={safeAssessmentExternalLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card/55 px-3 py-2 text-xs font-bold text-info transition-colors hover:bg-card"
                                        >
                                            <LinkIcon className="h-4 w-4 shrink-0" />
                                            <span className="truncate">External Resource</span>
                                        </a>
                                    )}
                                    {assessment.files?.map(file => (
                                        <a
                                            key={file.id}
                                            href={getPublicUrl(file.path)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-w-0 items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
                                        >
                                            <Download className="h-4 w-4 shrink-0" />
                                            <span className="min-w-0 flex-1 truncate">{file.filename || 'Download File'}</span>
                                            {file.size && <span className="shrink-0 text-[9px] opacity-70">{formatBytes(file.size)}</span>}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ResourcePanel>

                    {/* Grading Table (Teachers & Admins) */}
                    {isTeacherOrAdmin && (
                        <ResourcePanel className="overflow-hidden">
                            <div className="space-y-4 border-b border-border bg-primary/5 p-4 sm:p-6">
                                <StatusBanner
                                    variant="warning"
                                    title="Only Finalized grades appear in transcripts"
                                    description="Use Draft while entering marks and Published while sharing provisional results. Finalize when the grade is ready for the official transcript."
                                    dismissible={true}
                                />
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Users className="w-5 h-5 text-primary" />
                                        <h2 className="text-xl font-black text-foreground tracking-wider">Student <span className="hidden md:inline">Performance</span> & Grading</h2>
                                    </div>
                                    {canGrade && (
                                        <Button
                                            onClick={() => setShowBulkGrading(true)}
                                            variant='primary'
                                        >
                                            Grade All
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <DataTable
                                data={section.students || []}
                                columns={[
                                {
                                    header: 'Student Name',
                                    accessor: (student) => (
                                        <div className="flex items-center gap-3">
                                            <BrandIcon
                                                variant="user"
                                                size="sm"
                                                user={student.user}
                                                className="w-8 h-8 shadow-sm"
                                            />
                                            <div className="font-bold text-sm text-card-text">{student.user.name}</div>
                                        </div>
                                    ),
                                    width: 250,
                                },
                                {
                                    header: 'Reg #',
                                    accessor: 'registrationNumber',
                                    width: 120,
                                },
                                {
                                    header: 'Status',
                                    accessor: (student) => {
                                        const grade = grades.find(g => g.studentId === student.id);
                                        return grade ? (
                                            <Badge variant={grade.status === GradeStatus.FINALIZED ? 'success' : grade.status === GradeStatus.PUBLISHED ? 'info' : 'warning'} size="sm">
                                                {grade.status === GradeStatus.FINALIZED ? 'Finalized' : grade.status === GradeStatus.PUBLISHED ? 'Published' : 'Draft'}
                                            </Badge>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-warning">
                                                <Calendar className="w-3.5 h-3.5" /> Pending
                                            </span>
                                        );
                                    },
                                    width: 120,
                                },
                                {
                                    header: 'Submission',
                                    accessor: (student) => {
                                        const submission = submissions.find(s => s.studentId === student.id);
                                        const safeSubmissionUrl = normalizeSafeUrl(submission?.fileUrl, { allowRelative: false });
                                        return submission ? (
                                            (submission.files && submission.files.length > 0) ? (
                                                <a
                                                    href={getPublicUrl(submission.files[0].path)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-primary-light flex items-center gap-1.5 underline-offset-2 hover:underline font-black italic tracking-widest"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <LinkIcon className="w-3 h-3" /> View Work
                                                </a>
                                            ) : safeSubmissionUrl ? (
                                                <a
                                                    href={safeSubmissionUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-primary-light flex items-center gap-1.5 underline-offset-2 hover:underline font-black italic tracking-widest"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <LinkIcon className="w-3 h-3" /> View Link
                                                </a>
                                            ) : submission.message ? (
                                                <span className="text-info italic flex items-center gap-1.5 font-black tracking-widest">
                                                    <CheckCircle2 className="w-3 h-3" /> Text Submitted
                                                </span>
                                            ) : (
                                                <span className="text-success italic flex items-center gap-1.5 font-black tracking-widest"><CheckCircle2 className="w-3 h-3" /> Done</span>
                                            )
                                        ) : (
                                            <span className="text-muted-foreground italic font-black tracking-widest">No Submission</span>
                                        );
                                    },
                                    width: 150,
                                },
                                {
                                    header: 'Marks',
                                    accessor: (student) => {
                                        const grade = grades.find(g => g.studentId === student.id);
                                        return grade ? (
                                            <span className="text-lg font-black italic text-primary">{grade.marksObtained}<span className="text-xs text-card-text/30 ml-1">/ {assessment.totalMarks}</span></span>
                                        ) : (
                                            <span className="text-xs font-black text-muted-foreground italic tracking-tighter">Not Assigned</span>
                                        );
                                    },
                                    width: 120,
                                },
                                {
                                    header: 'Submission Note',
                                    accessor: (student) => {
                                        const submission = submissions.find(s => s.studentId === student.id);
                                        return submission?.message ? (
                                            <span className="text-sm font-semibold text-card-text">{submission.message}</span>
                                        ) : (
                                            <span className="text-xs font-black text-muted-foreground italic tracking-tighter">No note</span>
                                        );
                                    },
                                    width: 220,
                                },
                                {
                                    header: 'Actions',
                                    accessor: (student) => {
                                        const grade = grades.find(g => g.studentId === student.id);
                                        if (!canGrade) return null;
                                        if (grade?.status === GradeStatus.FINALIZED) {
                                            return <Badge variant="success" size="sm">Locked</Badge>;
                                        }
                                        return (
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedStudentId(student.id);
                                                }}
                                                py='py-1'
                                                px='px-3'
                                                variant={grade ? 'warning' : 'primary'}
                                            >
                                                {grade ? 'Update Grade' : 'Assign Grade'}
                                            </Button>
                                        );
                                    },
                                    width: 150,
                                },
                                ]}
                                keyExtractor={(student) => student.id}
                                onRowClick={(student) => {
                                    const submission = submissions.find(s => s.studentId === student.id);
                                    const safeSubmissionUrl = normalizeSafeUrl(submission?.fileUrl, { allowRelative: false });
                                    if (safeSubmissionUrl) {
                                        window.open(safeSubmissionUrl, '_blank', 'noopener,noreferrer');
                                    }
                                }}
                                currentPage={1}
                                totalPages={1}
                                showSerialNumber
                                totalResults={section.students?.length || 0}
                                pageSize={section.students?.length || 10}
                                onPageChange={() => { }}
                                disableZebra={true}
                                maxHeight="100%"
                            />
                        </ResourcePanel>
                    )}
                </>
            ) : null}

            {/* Bulk Grading Modal */}
            {assessment && section && showBulkGrading && canGrade && (
                <BulkGradingModal
                    isOpen={showBulkGrading}
                    onClose={() => setShowBulkGrading(false)}
                    assessment={assessment}
                    section={section}
                    existingGrades={grades}
                    onSuccess={() => mutate(assessmentKey)}
                />
            )}

            {/* Grading Modal */}
            {assessment && section && (
                <Modal
                isOpen={!!selectedStudentId}
                onClose={() => setSelectedStudentId(null)}
                title="Student Grading"
                subtitle={selectedStudentId ? section.students?.find(s => s.id === selectedStudentId)?.user.name : ''}
                maxWidth="max-w-xl"
            >
                {selectedStudentId && (() => {
                    const student = section.students?.find(s => s.id === selectedStudentId);
                    if (!student) return null;
                    return (
                        <GradingForm
                            assessmentId={assessmentId}
                            student={student}
                            totalMarks={assessment.totalMarks}
                            initialData={grades.find(g => g.studentId === selectedStudentId)}
                            onSuccess={() => {
                                mutate(assessmentKey);
                                setSelectedStudentId(null);
                                dispatch({ type: 'TOAST_ADD', payload: { message: 'Grade saved successfully', type: 'success' } });
                            }}
                            onCancel={() => setSelectedStudentId(null)}
                        />
                    );
                })()}
                </Modal>
            )}
        </PageShell>
    );
}
