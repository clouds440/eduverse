'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Section, Assessment, Attachment, ApiError, GradeStatus } from '@/types';
import { BookOpen, Check, FileText, PlayCircle, UploadCloud } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Modal } from '@/components/ui/Modal';
import { getPublicUrl, formatBytes, getSectionColor } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

function getGradeTone(marks: number, total: number) {
    const percentage = total > 0 ? (marks / total) * 100 : 0;
    if (percentage < 40) return { bg: 'bg-danger/10', border: 'border-danger/20', text: 'text-danger', label: 'Needs work' };
    if (percentage < 60) return { bg: 'bg-warning/10', border: 'border-warning/20', text: 'text-warning', label: 'Passing' };
    return { bg: 'bg-success/10', border: 'border-success/20', text: 'text-success', label: 'Strong' };
}

function isPublishedGrade(assessment: Assessment) {
    const grade = assessment.grades?.[0];
    return Boolean(grade && (grade.status === GradeStatus.PUBLISHED || grade.status === GradeStatus.FINALIZED));
}

function isSubmitted(assessment: Assessment, submittedAssessmentIds: Set<string>) {
    return Boolean(assessment.submissions?.length || submittedAssessmentIds.has(assessment.id));
}

function getDueDateLabel(value?: string) {
    if (!value) return 'No due date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Assessments({ sections, assessments }: { sections: Section[], assessments: Assessment[] }) {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const assessmentIdFromUrl = searchParams.get('assessmentId');
    const selectedSectionId = searchParams.get('sectionId');

    const [search, setSearch] = useState('');
    const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const [submittedAssessmentIds, setSubmittedAssessmentIds] = useState<Set<string>>(new Set());
    const isSubmitting = state.ui.processing['assessment-submission'];

    const sectionMap = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);

    const resolveSection = useCallback((assessment: Assessment) => (
        sectionMap.get(assessment.sectionId) || assessment.section
    ), [sectionMap]);

    const sectionOptions = useMemo(() => {
        const byId = new Map<string, Section>();
        sections.forEach((section) => byId.set(section.id, section));
        assessments.forEach((assessment) => {
            if (assessment.section && !byId.has(assessment.sectionId)) byId.set(assessment.sectionId, assessment.section);
        });
        return Array.from(byId.values()).filter((section) => assessments.some((assessment) => assessment.sectionId === section.id));
    }, [assessments, sections]);

    const filteredAssessments = useMemo(() => {
        const query = search.trim().toLowerCase();
        return assessments.filter((assessment) => {
            const section = resolveSection(assessment);
            const matchesSection = selectedSectionId ? assessment.sectionId === selectedSectionId : true;
            const matchesSearch = !query
                || assessment.title.toLowerCase().includes(query)
                || assessment.type.toLowerCase().includes(query)
                || section?.name?.toLowerCase().includes(query)
                || section?.course?.name?.toLowerCase().includes(query);
            return matchesSection && matchesSearch;
        });
    }, [assessments, search, selectedSectionId, resolveSection]);

    useEffect(() => {
        if (!assessmentIdFromUrl || assessments.length === 0) {
            setSelectedAssessment(null);
            return;
        }

        const found = assessments.find((assessment) => assessment.id === assessmentIdFromUrl);
        if (!found) return;

        if (!selectedSectionId) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('sectionId', found.sectionId);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        }
        setSelectedAssessment(found);
    }, [assessmentIdFromUrl, assessments, pathname, router, searchParams, selectedSectionId]);

    const handleCloseModal = () => {
        setSelectedAssessment(null);
        setSelectedFile(null);
        setSubmissionMessage('');
        if (assessmentIdFromUrl) router.back();
    };

    const handleSelectSection = (id: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (id) {
            params.set('sectionId', id);
        } else {
            params.delete('sectionId');
            params.delete('assessmentId');
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleOpenAssessment = (assessment: Assessment) => {
        setSelectedAssessment(assessment);
        setSelectedFile(null);
        setSubmissionMessage('');
        const params = new URLSearchParams(searchParams.toString());
        params.set('sectionId', assessment.sectionId);
        params.set('assessmentId', assessment.id);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleSubmission = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token || !user || !selectedAssessment) return;
        const message = submissionMessage.trim();
        const alreadyGraded = isPublishedGrade(selectedAssessment);

        if (alreadyGraded) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Submissions are closed because this assessment has already been graded.', type: 'info' } });
            return;
        }

        if (selectedAssessment.allowSubmissions && !selectedFile && !message) {
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Add a file or a message before submitting.', type: 'error' } });
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'assessment-submission' });
        try {
            const submission = await api.org.createSubmission(selectedAssessment.id, {
                assessmentId: selectedAssessment.id,
                message: message || undefined,
            }, token);

            if (selectedFile) {
                await api.files.uploadFile(selectedAssessment.organizationId, 'SUBMISSION', submission.id, selectedFile, token);
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Assessment submitted successfully', type: 'success' } });
            setSubmittedAssessmentIds((current) => new Set(current).add(selectedAssessment.id));
            handleCloseModal();
            router.refresh();
        } catch (error: unknown) {
            const apiError = error as ApiError;
            const message = apiError.response?.data?.message || 'Failed to submit assessment';
            dispatch({ type: 'TOAST_ADD', payload: { message: Array.isArray(message) ? message[0] : message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'assessment-submission' });
        }
    };

    const getVideoEmbedUrl = (url: string) => {
        if (url.includes('youtube.com/watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            return normalizeSafeUrl(`https://www.youtube.com/embed/${videoId}`, { allowRelative: false }) || '';
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return normalizeSafeUrl(`https://www.youtube.com/embed/${videoId}`, { allowRelative: false }) || '';
        }
        return normalizeSafeUrl(url, { allowRelative: false }) || '';
    };

    const selectedSection = selectedAssessment ? resolveSection(selectedAssessment) : null;
    const selectedExternalLink = normalizeSafeUrl(selectedAssessment?.externalLink, { allowRelative: false });
    const selectedAssessmentGraded = selectedAssessment ? isPublishedGrade(selectedAssessment) : false;
    const selectedAssessmentSubmitted = selectedAssessment ? isSubmitted(selectedAssessment, submittedAssessmentIds) : false;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-wrap gap-2">
                    <Button
                        type="button"
                        variant={!selectedSectionId ? 'primary' : 'secondary'}
                        onClick={() => handleSelectSection(null)}
                    >
                        All
                    </Button>
                    {sectionOptions.map((section) => (
                        <Button
                            key={section.id}
                            type="button"
                            variant={selectedSectionId === section.id ? 'primary' : 'secondary'}
                            onClick={() => handleSelectSection(section.id)}
                            className="max-w-full"
                        >
                            <CourseSectionLabel section={section} className="max-w-52 truncate" />
                        </Button>
                    ))}
                </div>
                <div className="w-full xl:w-80">
                    <SearchBar
                        placeholder="Search assessments..."
                        value={search}
                        onChange={setSearch}
                    />
                </div>
            </div>

            {filteredAssessments.length === 0 ? (
                <EmptyState
                    icon={BookOpen}
                    title={assessments.length === 0 ? 'No assessments yet' : 'No assessments found'}
                    description={assessments.length === 0 ? 'Published assessments will appear here.' : 'Try another course, title, or assessment type.'}
                    className="min-h-80"
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {filteredAssessments.map((assessment) => {
                        const section = resolveSection(assessment);
                        const sectionColor = getSectionColor(section?.color);
                        const grade = assessment.grades?.[0];
                        const hasGrade = isPublishedGrade(assessment);
                        const submitted = isSubmitted(assessment, submittedAssessmentIds);
                        const status = hasGrade ? 'Graded' : submitted ? 'Submitted' : 'Pending';
                        const statusClass = hasGrade ? 'bg-success/10 text-success border-success/20' : submitted ? 'bg-info/10 text-info border-info/20' : 'bg-warning/10 text-warning border-warning/20';

                        return (
                            <Card
                                key={assessment.id}
                                onClick={() => handleOpenAssessment(assessment)}
                                padding="md"
                                className="min-h-56"
                                style={{ boxShadow: `inset 3px 0 0 ${sectionColor}` }}
                            >
                                <CardHeader>
                                    <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black ${statusClass}`}>
                                        {status}
                                    </span>
                                    <div
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"
                                        style={{ borderColor: `${sectionColor}40`, backgroundColor: `${sectionColor}14`, color: sectionColor }}
                                    >
                                        <BookOpen className="h-5 w-5" />
                                    </div>
                                </CardHeader>

                                <CardContent>
                                    <div>
                                        <h3 className="line-clamp-2 text-lg font-black leading-tight text-foreground">{assessment.title}</h3>
                                        <div className="mt-2">
                                            <CourseSectionLabel
                                                section={section}
                                                courseName={section?.course?.name}
                                                sectionName={section?.name}
                                                color={sectionColor}
                                                className="text-sm font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-3">
                                            <p className="text-muted-foreground">Type</p>
                                            <p className="mt-1 truncate text-foreground">{assessment.type}</p>
                                        </div>
                                        <div className="rounded-md border border-border/60 bg-muted/25 p-3">
                                            <p className="text-muted-foreground">Due</p>
                                            <p className="mt-1 truncate text-foreground">{getDueDateLabel(assessment.dueDate)}</p>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter>
                                    {hasGrade && grade ? (
                                        <div className={`flex w-full items-center justify-between rounded-md border px-3 py-2 ${getGradeTone(grade.marksObtained, assessment.totalMarks).bg} ${getGradeTone(grade.marksObtained, assessment.totalMarks).border}`}>
                                            <span className={`text-xs font-black ${getGradeTone(grade.marksObtained, assessment.totalMarks).text}`}>Your Score</span>
                                            <span className={`text-sm font-black ${getGradeTone(grade.marksObtained, assessment.totalMarks).text}`}>
                                                {grade.marksObtained} / {assessment.totalMarks}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-muted-foreground">
                                            {submitted ? 'Submission recorded' : assessment.allowSubmissions ? 'Submission required' : 'Open for details'}
                                        </span>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}

            {selectedAssessment && (
                <Modal isOpen={true} onClose={handleCloseModal} title="Assessment Details" maxWidth="max-w-5xl" className="mt-10 w-full md:w-[90vw]">
                    <div className="space-y-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <h2 className="text-2xl font-black leading-tight text-foreground">{selectedAssessment.title}</h2>
                                <div className="mt-2">
                                    <CourseSectionLabel
                                        section={selectedSection || undefined}
                                        courseName={selectedSection?.course?.name}
                                        sectionName={selectedSection?.name}
                                        color={selectedSection?.color}
                                        className="text-sm font-bold"
                                    />
                                </div>
                            </div>
                            <span className={`w-fit rounded-md border px-3 py-1.5 text-xs font-black ${isPublishedGrade(selectedAssessment) ? 'border-success/20 bg-success/10 text-success' : isSubmitted(selectedAssessment, submittedAssessmentIds) ? 'border-info/20 bg-info/10 text-info' : 'border-warning/20 bg-warning/10 text-warning'}`}>
                                {isPublishedGrade(selectedAssessment) ? 'Graded' : isSubmitted(selectedAssessment, submittedAssessmentIds) ? 'Submitted' : 'Pending'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/25 p-3 sm:grid-cols-4">
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">Type</p>
                                <p className="mt-1 text-sm font-black text-foreground">{selectedAssessment.type}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">Total Marks</p>
                                <p className="mt-1 text-sm font-black text-foreground">{selectedAssessment.totalMarks}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">Weightage</p>
                                <p className="mt-1 text-sm font-black text-foreground">{selectedAssessment.weightage}%</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-muted-foreground">Due Date</p>
                                <p className="mt-1 text-sm font-black text-foreground">{getDueDateLabel(selectedAssessment.dueDate)}</p>
                            </div>
                        </div>

                        {isPublishedGrade(selectedAssessment) && selectedAssessment.grades?.[0] && (() => {
                            const grade = selectedAssessment.grades[0];
                            const tone = getGradeTone(grade.marksObtained, selectedAssessment.totalMarks);
                            return (
                                <div className={`rounded-lg border p-4 ${tone.bg} ${tone.border}`}>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className={`flex items-center gap-2 font-black ${tone.text}`}>
                                            <Check className="h-5 w-5" />
                                            Your Result
                                        </div>
                                        <p className={`text-2xl font-black ${tone.text}`}>
                                            {grade.marksObtained} <span className="text-sm opacity-70">/ {selectedAssessment.totalMarks}</span>
                                        </p>
                                    </div>
                                    {grade.feedback && (
                                        <div className="mt-4 rounded-md border border-border/50 bg-card/70 p-3">
                                            <p className="text-xs font-bold text-muted-foreground">Teacher Remarks</p>
                                            <p className="mt-2 text-sm font-medium text-foreground">{grade.feedback}</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {selectedAssessment.files && selectedAssessment.files.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-black text-foreground">Attachments</h3>
                                {selectedAssessment.files.map((file: Attachment) => (
                                    <a
                                        key={file.id}
                                        href={getPublicUrl(file.path)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/45"
                                    >
                                        <FileText className="h-5 w-5 shrink-0 text-primary" />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-foreground">{file.filename}</p>
                                            <p className="text-xs font-medium text-muted-foreground">{formatBytes(file.size)}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}

                        {selectedExternalLink && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-black text-foreground">External Resource</h3>
                                {selectedAssessment.isVideoLink ? (
                                    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
                                        <iframe
                                            src={getVideoEmbedUrl(selectedExternalLink)}
                                            className="h-full w-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>
                                ) : (
                                    <a href={selectedExternalLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm font-black text-primary transition-colors hover:bg-primary/15">
                                        <PlayCircle className="h-5 w-5" />
                                        Open External Link
                                    </a>
                                )}
                            </div>
                        )}

                        {selectedAssessmentGraded && (
                            <div className="rounded-lg border border-success/20 bg-success/10 p-4 text-sm font-bold text-success">
                                Submissions are closed because this assessment has already been graded.
                            </div>
                        )}

                        {!selectedAssessmentGraded && !selectedAssessmentSubmitted && (
                            <form onSubmit={handleSubmission} className="space-y-4 border-t border-border pt-5">
                                <h3 className="text-sm font-black text-foreground">Submit Work</h3>

                                {selectedAssessment.allowSubmissions && (
                                    <div>
                                        <input
                                            type="file"
                                            id="student-file-upload"
                                            className="hidden"
                                            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                                            accept=".txt,.pdf,image/*,.docx,.xlsx,.pptx,.zip"
                                        />
                                        <label
                                            htmlFor="student-file-upload"
                                            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30"
                                        >
                                            <UploadCloud className="mb-2 h-8 w-8" />
                                            <span className="text-sm font-bold text-foreground">
                                                {selectedFile ? selectedFile.name : 'Choose a file to upload'}
                                            </span>
                                            <span className="mt-1 text-xs font-medium">PDF, DOCX, ZIP, or images up to the configured upload limit</span>
                                        </label>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label htmlFor="student-submission-message" className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                        Message
                                    </label>
                                    <Textarea
                                        id="student-submission-message"
                                        value={submissionMessage}
                                        onChange={(event) => setSubmissionMessage(event.target.value)}
                                        placeholder="Write your answer, notes, or context for your teacher. You can submit text only, a file only, or both."
                                        className="min-h-32"
                                        maxLength={5000}
                                    />
                                </div>

                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" loadingId="assessment-submission" disabled={isSubmitting || (selectedAssessment.allowSubmissions && !selectedFile && !submissionMessage.trim())}>
                                        {selectedAssessment.allowSubmissions ? 'Submit Work' : 'Mark as Done'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
}
