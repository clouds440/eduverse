'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Section, Assessment, Attachment, ApiError, GradeStatus } from '@/types';
import { BookOpen, Calendar, PlayCircle, FileText, UploadCloud, Check, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Modal } from '@/components/ui/Modal';
import { getPublicUrl, formatBytes } from '@/lib/utils';
import { normalizeSafeUrl } from '@/lib/safeUrl';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';

const getGradeColors = (marks: number, total: number) => {
    const percentage = (marks / total) * 100;
    if (percentage < 40) {
        return {
            bg: 'bg-danger/10',
            border: 'border-danger/20',
            text: 'text-danger',
            accent: 'text-danger',
            light: 'text-danger',
            muted: 'text-danger/60',
            fill: 'text-danger',
            dark: 'text-danger',
            borderDark: 'border-danger/30'
        };
    }
    if (percentage < 60) {
        return {
            bg: 'bg-warning/10',
            border: 'border-warning/20',
            text: 'text-warning',
            accent: 'text-warning',
            light: 'text-warning',
            muted: 'text-warning/60',
            fill: 'text-warning',
            dark: 'text-warning',
            borderDark: 'border-warning/30'
        };
    }
    return {
        bg: 'bg-success/10',
        border: 'border-success/20',
        text: 'text-success',
        accent: 'text-success',
        light: 'text-success',
        muted: 'text-success/60',
        fill: 'text-success',
        dark: 'text-success',
        borderDark: 'border-success/30'
    };
};

export default function Assessments({ sections, assessments }: { sections: Section[], assessments: Assessment[] }) {
    const { token, user } = useAuth();
    const { state, dispatch } = useGlobal();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const assessmentIdFromUrl = searchParams.get('assessmentId');
    const sectionIdFromUrl = searchParams.get('sectionId');
    const selectedSectionId = sectionIdFromUrl;

    const [search, setSearch] = useState('');
    const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
    const isSubmitting = state.ui.processing['assessment-submission'];
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [submittedAssessmentIds, setSubmittedAssessmentIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (assessmentIdFromUrl && assessments.length > 0) {
            const found = assessments.find(a => a.id === assessmentIdFromUrl);
            if (found && selectedAssessment?.id !== found.id) {
                // If sectionId is missing from URL but we have an assessmentId, sync it
                if (!sectionIdFromUrl) {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('sectionId', found.sectionId);
                    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
                }
                setSelectedAssessment(found);
            }
        } else if (!assessmentIdFromUrl && selectedAssessment) {
            setSelectedAssessment(null);
        }
    }, [assessmentIdFromUrl, assessments, selectedAssessment, sectionIdFromUrl, searchParams, pathname, router]);

    const handleCloseModal = () => {
        setSelectedAssessment(null);
        // If the ID is in the URL, go back to remove it from history smoothly
        if (assessmentIdFromUrl) {
            router.back();
        }
    };

    const handleSelectSection = (id: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (id) {
            params.set('sectionId', id);
        } else {
            params.delete('sectionId');
            params.delete('assessmentId'); // Also clear any open assessment if going back to course list
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const filteredAssessments = assessments.filter(ann =>
        (selectedSectionId ? ann.sectionId === selectedSectionId : true) &&
        (ann.title.toLowerCase().includes(search.toLowerCase()) ||
            ann.section?.name.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSubmission = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !user || !selectedAssessment) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'assessment-submission' });
        try {
            const submissionRes = await api.org.createSubmission(selectedAssessment.id, {
                assessmentId: selectedAssessment.id,
            }, token);

            if (selectedFile) {
                await api.files.uploadFile(selectedAssessment.organizationId, 'SUBMISSION', submissionRes.id, selectedFile, token);
            }

            dispatch({ type: 'TOAST_ADD', payload: { message: 'Assessment submitted successfully', type: 'success' } });
            if (selectedAssessment) {
                setSubmittedAssessmentIds(prev => new Set(prev).add(selectedAssessment.id));
            }
            setSelectedAssessment(null);
            setSelectedFile(null);
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
        if (!url) return '';
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
    const safeSelectedExternalLink = normalizeSafeUrl(selectedAssessment?.externalLink, { allowRelative: false });

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-10 px-4 sm:px-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tighter leading-none">
                        {selectedSectionId ? sections.find(s => s.id === selectedSectionId)?.course?.name || sections.find(s => s.id === selectedSectionId)?.name : 'Assessments'}
                    </h1>
                    <p className="text-muted-foreground mt-3 font-bold max-w-md tracking-tight">
                        {selectedSectionId ? 'Viewing all assessments for this course.' : 'View your coursework, quizzes, and project assignments.'}
                    </p>
                </div>
                <div className="w-full md:w-80">
                    <SearchBar
                        placeholder="Search assessments..."
                        value={search}
                        onChange={setSearch}
                    />
                </div>
            </div>

            {!selectedSectionId ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sections.map((sec, index) => {
                        const courseAssessments = assessments.filter(a => a.sectionId === sec.id);
                        if (courseAssessments.length === 0) return null;

                        const doneCount = courseAssessments.filter(a => (a._count?.submissions || 0) > 0).length;
                        const quizzesCount = courseAssessments.filter(a => a.type === 'QUIZ').length;
                        const assignmentsCount = courseAssessments.filter(a => a.type === 'ASSIGNMENT').length;
                        const teacherName = sec.teachers?.[0]?.user?.name || 'Assigned Professor';

                        return (
                            <Card
                                key={sec.id}
                                onClick={() => handleSelectSection(sec.id)}
                                accentColor="bg-primary"
                                padding="lg"
                                delay={index * 100}
                            >
                                <CardHeader>
                                    <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/20 shadow-xs tracking-[0.15em]">
                                        {courseAssessments.length} Modules
                                    </span>
                                    <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors border border-primary/20 shadow-xs">
                                        < BookOpen className="w-5 h-5 text-primary" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <h3 className="text-xl font-black text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2 tracking-tight">
                                        {sec.course?.name || sec.name}
                                    </h3>
                                    <p className="text-[10px] font-black text-muted-foreground/60 tracking-widest leading-none mt-2">{teacherName}</p>
                                </CardContent>
                                <CardFooter className="flex-col gap-4 items-stretch border-border">
                                    <div className="flex justify-between items-center text-[10px] font-black tracking-widest">
                                        <span className="text-muted-foreground/60">Total Progress</span>
                                        <span className="text-success px-2 py-0.5 bg-success/10 rounded border border-success/20 tracking-tighter">
                                            {doneCount} / {courseAssessments.length} Done
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1 no-scrollbar">
                                        {quizzesCount > 0 && (
                                            <span className="whitespace-nowrap px-2 py-1 bg-muted text-muted-foreground text-[9px] font-black rounded-lg border border-border tracking-wider transition-all group-hover:border-primary/20 group-hover:text-primary shadow-xs">
                                                {quizzesCount} Quizzes
                                            </span>
                                        )}
                                        {assignmentsCount > 0 && (
                                            <span className="whitespace-nowrap px-2 py-1 bg-muted text-muted-foreground text-[9px] font-black rounded-lg border border-border tracking-wider transition-all group-hover:border-primary/20 group-hover:text-primary shadow-xs">
                                                {assignmentsCount} Labs
                                            </span>
                                        )}
                                    </div>
                                </CardFooter>
                            </Card>
                        );
                    })}
                    {sections.filter(sec => assessments.some(a => a.sectionId === sec.id)).length === 0 && (
                        <div className="col-span-full p-16 bg-card border border-dashed border-border rounded-2xl text-center shadow-sm">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                <BookOpen className="w-8 h-8 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-1">No Active Courses</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">There are no courses with published assessments right now.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-1">
                    {filteredAssessments.map((ann, index) => {
                        const hasGrade = ann.grades && ann.grades.length > 0 && (ann.grades[0].status === GradeStatus.PUBLISHED || ann.grades[0].status === GradeStatus.FINALIZED);
                        const isSubmitted = (ann._count?.submissions || 0) > 0 || submittedAssessmentIds.has(ann.id);
                        return (
                            <Card
                                key={ann.id}
                                onClick={() => {
                                    setSelectedAssessment(ann);
                                    const params = new URLSearchParams(searchParams.toString());
                                    params.set('assessmentId', ann.id);
                                    router.push(`${pathname}?${params.toString()}`, { scroll: false });
                                }}
                                accentColor="bg-primary"
                                padding="lg"
                                delay={index * 50}
                            >
                                <CardHeader>
                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg tracking-widest border border-border/50 shadow-sm ${hasGrade ? 'bg-success/10 text-success' : isSubmitted ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'}`}>
                                        {hasGrade ? 'Graded' : isSubmitted ? 'Work submitted' : 'Pending'}
                                    </span>
                                    <div className="p-2.5 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors border border-primary/20 shadow-xs">
                                        <BookOpen className="w-5 h-5 text-primary" />
                                    </div>
                                </CardHeader>

                                <CardContent>
                                    <h3 className="text-xl font-black text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2 tracking-tight">
                                        {ann.title}
                                    </h3>
                                    <p className="text-xs font-bold text-muted-foreground/60 tracking-widest">{ann.section?.name}</p>
                                </CardContent>

                                <CardFooter className="flex-col gap-4 items-stretch border-border">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-[10px] font-black tracking-widest">
                                            <span className="text-muted-foreground/60">Type</span>
                                            <span className="text-foreground px-2 py-0.5 bg-muted rounded border border-border">{ann.type}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-black tracking-widest">
                                            <span className="text-muted-foreground/60 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary/50" /> Due Date</span>
                                            <span className={`px-2 py-0.5 rounded border ${!ann.dueDate ? 'text-muted-foreground/60 bg-muted border-border' : 'text-foreground bg-muted border-border'}`}>
                                                {ann.dueDate ? new Date(ann.dueDate).toLocaleDateString() : 'None'}
                                            </span>
                                        </div>
                                    </div>
                                    {(ann.grades && ann.grades.length > 0 && (ann.grades[0].status === GradeStatus.PUBLISHED || ann.grades[0].status === GradeStatus.FINALIZED)) && (() => {
                                        const colors = getGradeColors(ann.grades[0].marksObtained, ann.totalMarks);
                                        return (
                                            <div className={`flex items-center justify-between text-[10px] mt-1 p-3 ${colors.bg} rounded-xl border-2 ${colors.border} shadow-sm`}>
                                                <span className={`${colors.text} font-black tracking-widest`}>Your Score</span>
                                                <span className={`text-sm font-black ${colors.accent}`}>{ann.grades[0].marksObtained} <span className="text-[10px] opacity-60">/ {ann.totalMarks}</span></span>
                                            </div>
                                        );
                                    })()}
                                </CardFooter>
                            </Card>
                        );
                    })}
                    {filteredAssessments.length === 0 && (
                        <div className="col-span-full p-16 bg-card border border-dashed border-border rounded-2xl text-center shadow-sm">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                                <BookOpen className="w-8 h-8 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-1">No Assessments Found</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">There are no assessments matching your criteria for this course.</p>
                        </div>
                    )}
                </div>
            )}

            {selectedAssessment && (
                <Modal isOpen={true} onClose={handleCloseModal} title="Assessment Details" maxWidth="max-w-5xl" className="w-full mt-16 md:mt-10 md:w-[90vw]">
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-black text-foreground tracking-tight">{selectedAssessment.title}</h2>
                                <p className="text-muted-foreground font-medium mt-1">{selectedAssessment.section?.name}</p>
                            </div>
                            {(() => {
                                const hasGrade = selectedAssessment.grades && selectedAssessment.grades.length > 0 && (selectedAssessment.grades[0].status === GradeStatus.PUBLISHED || selectedAssessment.grades[0].status === GradeStatus.FINALIZED);
                                const isSubmitted = (selectedAssessment._count?.submissions || 0) > 0 || submittedAssessmentIds.has(selectedAssessment.id);
                                return (
                                    <span className={`self-start text-xs font-bold px-3 py-1.5 rounded-lg tracking-wider ${hasGrade ? 'bg-success/10 text-success' : isSubmitted ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'}`}>
                                        {hasGrade ? 'Graded' : isSubmitted ? 'Work submitted' : 'Pending'}
                                    </span>
                                );
                            })()}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-widest mb-1">Type</p>
                                <p className="text-sm font-bold text-foreground">{selectedAssessment.type}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-widest mb-1">Total Marks</p>
                                <p className="text-sm font-bold text-foreground">{selectedAssessment.totalMarks}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-widest mb-1">Weightage</p>
                                <p className="text-sm font-bold text-foreground">{selectedAssessment.weightage}%</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground/60 tracking-widest mb-1">Due Date</p>
                                <p className="text-sm font-bold text-foreground">{selectedAssessment.dueDate ? new Date(selectedAssessment.dueDate).toLocaleDateString() : 'None'}</p>
                            </div>
                        </div>

                        {(selectedAssessment.grades && selectedAssessment.grades.length > 0 && (selectedAssessment.grades[0].status === GradeStatus.PUBLISHED || selectedAssessment.grades[0].status === GradeStatus.FINALIZED)) && (() => {
                            const colors = getGradeColors(selectedAssessment.grades[0].marksObtained, selectedAssessment.totalMarks);
                            return (
                                <div className={`space-y-4 p-6 ${colors.bg} rounded-2xl border ${colors.border} shadow-inner`}>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <h3 className={`text-lg font-black ${colors.dark} tracking-tight flex items-center gap-2`}>
                                            <Check className={`w-6 h-6 ${colors.fill}`} />
                                            Your Result
                                        </h3>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className={`text-[10px] font-black ${colors.muted} tracking-widest mb-0.5`}>Obtained Marks</p>
                                                <p className={`text-3xl font-black ${colors.accent} leading-none`}>{selectedAssessment.grades[0].marksObtained} <span className={`text-sm ${colors.light}`}>/ {selectedAssessment.totalMarks}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedAssessment.grades[0].feedback && (
                                        <div className={`pt-4 border-t ${colors.borderDark || colors.border}`}>
                                            <p className={`text-[10px] font-bold ${colors.muted} tracking-widest mb-2`}>Teacher Remarks</p>
                                            <p className="text-foreground font-medium leading-relaxed bg-card/60 p-4 rounded-xl shadow-xs">
                                                &quot;{selectedAssessment.grades[0].feedback}&quot;
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {(selectedAssessment.files && selectedAssessment.files.length > 0) && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-foreground tracking-widest">Attachments</h3>
                                {selectedAssessment.files.map((file: Attachment) => (
                                    <a key={file.id} href={getPublicUrl(file.path)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-sm transition-all group">
                                        <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{file.filename}</p>
                                            <p className="text-xs text-muted-foreground font-medium">{formatBytes(file.size)}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}

                        {safeSelectedExternalLink && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-foreground tracking-widest">External Resource</h3>
                                {selectedAssessment.isVideoLink ? (
                                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-border shadow-inner bg-black">
                                        <iframe
                                            src={getVideoEmbedUrl(safeSelectedExternalLink)}
                                            className="w-full h-full"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                ) : (
                                    <a href={safeSelectedExternalLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-colors">
                                        <PlayCircle className="w-6 h-6 text-primary" />
                                        <span className="text-sm font-bold text-primary italic">Open External Link</span>
                                    </a>
                                )}
                            </div>
                        )}

                        {selectedAssessment._count?.submissions === 0 && (
                            <form onSubmit={handleSubmission} className="space-y-4 pt-6 border-t border-border">
                                <h3 className="text-sm font-bold text-foreground tracking-widest">Submit Work</h3>

                                {selectedAssessment.allowSubmissions && (
                                    <div className="relative flex items-center gap-2">
                                        <input
                                            type="file"
                                            id="student-file-upload"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setSelectedFile(e.target.files[0]);
                                                }
                                            }}
                                            accept=".txt,.pdf,image/*,.docx,.xlsx,.pptx,.zip"
                                        />
                                        <label
                                            htmlFor="student-file-upload"
                                            className={`flex justify-center items-center gap-2 w-full px-4 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${selectedFile ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50 text-muted-foreground/60 hover:bg-muted/30'}`}
                                        >
                                            <div className="flex flex-col items-center">
                                                <UploadCloud className={`w-8 h-8 mb-2 ${selectedFile ? 'text-primary' : 'text-muted-foreground/40'}`} />
                                                <span className="font-bold">
                                                    {selectedFile ? selectedFile.name : 'Click to upload your submission'}
                                                </span>
                                                <span className="text-xs font-medium mt-1 opacity-70">PDF, DOCX, ZIP, or Images up to 50MB</span>
                                            </div>
                                        </label>

                                        {selectedFile && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFile(null);
                                                    const fileInput = document.getElementById('student-file-upload') as HTMLInputElement;
                                                    if (fileInput) fileInput.value = '';
                                                }}
                                                className="absolute top-4 right-4 p-1.5 bg-white border border-danger/30 text-danger rounded-lg hover:bg-danger/10 transition-colors shadow-sm"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button type="button" variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" loadingId="assessment-submission" disabled={isSubmitting || (selectedAssessment?.allowSubmissions && !selectedFile)}>
                                        {isSubmitting ? 'Submitting...' : (selectedAssessment?.allowSubmissions ? 'Upload & Mark as Done' : 'Mark as Done')}
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
