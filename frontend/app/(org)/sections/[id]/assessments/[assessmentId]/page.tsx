'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Users, Calendar, CheckCircle2, Link as LinkIcon, Download } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { Assessment, Section, Grade, Submission, Role } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { useParams } from 'next/navigation';
import { formatDate, getPublicUrl, formatBytes } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { Modal } from '@/components/ui/Modal';
import GradingForm from '@/components/forms/GradingForm';
import { BulkGradingModal } from '@/components/forms/BulkGradingModal';
import { BrandIcon } from '@/components/ui/Brand';
import { Loading } from '@/components/ui/Loading';
import { NotFound } from '@/components/NotFound';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { RouteBreadcrumbs } from '@/components/ui/PageShell';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { StatusBanner } from '@/components/ui/StatusBanner';

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
    const isTeacherOrAdmin = role === Role.TEACHER || role === Role.ORG_ADMIN || role === Role.ORG_MANAGER;
    const safeAssessmentExternalLink = normalizeSafeUrl(assessment?.externalLink, { allowRelative: false });

    if (isLoading && !assessmentData) {
        return (
            <div className="flex items-center justify-center p-12 h-[60vh]">
                <Loading size="lg" />
            </div>
        );
    }

    if (resourceExists === false) {
        return <NotFound page="Assessment" />;
    }

    if (!assessment || !section) return null;

    return (
        <div className="flex flex-col w-full space-y-8">
            {/* Assessment Header */}
            <div className="bg-card border border-border rounded-lg p-8 md:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none text-primary">
                    <Trophy className="w-40 h-40" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <RouteBreadcrumbs className="mb-2" />
                        <div className="flex items-center gap-3 mb-3">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[10px] font-black tracking-widest rounded-lg">
                                {assessment.type}
                            </span>
                            <span className="text-[10px] font-bold text-card-text/40 tracking-widest leading-none">
                                <CourseSectionLabel section={section} />
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-card-text">
                            {assessment.title}
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-6 text-center md:text-right">
                        <div>
                            <p className="text-[10px] font-black text-card-text/30 tracking-widest mb-1">Total Marks</p>
                            <p className="text-3xl font-black text-primary">{assessment.totalMarks}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-card-text/30 tracking-widest mb-1">Weightage</p>
                            <p className="text-3xl font-black text-card-text">{assessment.weightage}%</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-card-text/30 tracking-widest mb-1">Due Date</p>
                            <p className="text-lg font-black text-card-text/70">{assessment.dueDate ? formatDate(assessment.dueDate) : 'No Due Date'}</p>
                        </div>
                    </div>
                </div>

                {/* Resources Section */}
                {(safeAssessmentExternalLink || (assessment.files && assessment.files.length > 0)) && (
                    <div className="relative z-10 mt-8 pt-6 border-t border-border flex flex-wrap gap-4">
                        {safeAssessmentExternalLink && (
                            <a
                                href={safeAssessmentExternalLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-card/40 hover:bg-card border border-border rounded-lg text-xs font-bold transition-colors text-info/80 hover:text-info/40 shadow-sm"
                            >
                                <LinkIcon className="w-4 h-4" />
                                External Resource
                            </a>
                        )}
                        {assessment.files?.map(file => (
                            <a
                                key={file.id}
                                href={getPublicUrl(file.path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-xs font-bold transition-colors text-primary shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                <div className="flex flex-col text-left leading-none">
                                    <span className="truncate max-w-50">{file.filename || 'Download File'}</span>
                                    {file.size && <span className="text-[9px] opacity-70 mt-1 tracking-widest leading-none">{formatBytes(file.size)}</span>}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>

            {/* Grading Table (Teachers & Admins) */}
            {isTeacherOrAdmin && (
                <div className="bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                    <div className="space-y-4 border-b border-border bg-primary/5 p-4 sm:p-6">
                        <StatusBanner
                            variant="warning"
                            title="Only Finalized grades appear in transcripts"
                            description="Use Draft while entering marks and Published while sharing provisional results. Finalize when the grade is ready for the official transcript."
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
                                        <span className="flex items-center gap-1.5 text-success">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Graded
                                        </span>
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
                                accessor: (student) => canGrade ? (
                                    <Button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedStudentId(student.id);
                                        }}
                                        py='py-1'
                                        px='px-3'
                                        variant={grades.find(g => g.studentId === student.id) ? 'warning' : 'primary'}
                                    >
                                        {grades.find(g => g.studentId === student.id) ? 'Update Grade' : 'Assign Grade'}
                                    </Button>
                                ) : null,
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
                    />
                </div>
            )}

            {/* Bulk Grading Modal */}
            {showBulkGrading && canGrade && (
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
        </div>
    );
}
