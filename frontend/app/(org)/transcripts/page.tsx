'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { AcademicCycle, Role, Student } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { BrandIcon } from '@/components/ui/Brand';
import { PageHeader } from '@/components/ui/PageShell';
import { DocsLink } from '@/components/ui/DocsLink';
import { BookOpen, Download, GraduationCap, Printer, Search } from 'lucide-react';
import { formatCourseSectionLabel, getPublicUrl, getSectionColor } from '@/lib/utils';
import { PLATFORM_NAME } from '@/lib/constants';
import { downloadPdfBlob, sanitizePdfFilename } from '@/lib/pdf/core';
import { createTranscriptPdf } from '@/lib/pdf/transcript';

interface TranscriptStudent {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string | null;
    avatarUpdatedAt?: string | null;
    registrationNumber?: string | null;
    rollNumber?: string | null;
    currentCohort?: { id: string; name: string } | null;
}

interface TranscriptAssessmentGrade {
    assessmentTitle: string;
    assessmentType: string;
    marksObtained: number;
    totalMarks: number;
    weightage: number;
    percentage: number;
    status?: string;
}

interface TranscriptCycleSection {
    sectionId: string;
    sectionName: string;
    sectionColor?: string | null;
    courseId?: string;
    courseName: string;
    enrollmentType: string;
    wasExcluded: boolean;
    grades?: TranscriptAssessmentGrade[];
    totalPercentage: number;
    creditHours?: number;
    letterGrade?: string;
    gradePoints?: number;
    qualityPoints?: number;
}

interface TranscriptCycle {
    academicCycle: { id: string; name: string; startDate?: string; endDate?: string } | null;
    cohortName: string | null;
    sections?: TranscriptCycleSection[];
    overallPercentage: number;
    gpa?: number;
    totalCreditHours?: number;
    gpaScale?: number;
    policyName?: string;
}

interface TranscriptSummary {
    cgpa: number;
    gpaScale: number;
    policyName: string;
    totalCreditHours: number;
}

interface TranscriptResponse {
    student: TranscriptStudent;
    transcript?: TranscriptCycle[];
    summary?: TranscriptSummary;
}

function roundScore(value: number) {
    return Math.round(value * 100) / 100;
}

function getSectionMetrics(section: TranscriptCycleSection) {
    const grades = (section.grades || []).filter((grade) => !grade.status || grade.status === 'FINALIZED');
    const marksObtained = roundScore(grades.reduce((sum, grade) => sum + Number(grade.marksObtained || 0), 0));
    const totalMarks = roundScore(grades.reduce((sum, grade) => sum + Number(grade.totalMarks || 0), 0));
    const totalWeight = roundScore(grades.reduce((sum, grade) => sum + Number(grade.weightage || 0), 0));
    const rawPercentage = totalMarks > 0 ? roundScore((marksObtained / totalMarks) * 100) : 0;
    const weightedScore = roundScore(section.totalPercentage || 0);
    const grade = section.wasExcluded || grades.length === 0 ? 'N/A' : section.letterGrade || 'N/A';

    return {
        assessmentCount: grades.length,
        marksObtained,
        totalMarks,
        totalWeight,
        rawPercentage,
        weightedScore,
        grade,
        creditHours: roundScore(Number(section.creditHours ?? 0)),
        gradePoints: section.gradePoints === undefined || section.gradePoints === null ? null : roundScore(Number(section.gradePoints)),
        qualityPoints: section.qualityPoints === undefined || section.qualityPoints === null ? null : roundScore(Number(section.qualityPoints)),
    };
}

function formatDate(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCyclePeriodLabel(cycle: TranscriptCycle) {
    const name = cycle.academicCycle?.name || 'Unassigned Cycle';
    const start = formatDate(cycle.academicCycle?.startDate);
    const end = formatDate(cycle.academicCycle?.endDate);
    if (!start && !end) return name;
    return `${name} (${start || 'Start TBD'} - ${end || 'End TBD'})`;
}

export default function TranscriptsPage() {
    const { token, user } = useAuth();
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedCycleId, setSelectedCycleId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isPdfOptionsOpen, setIsPdfOptionsOpen] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [transcriptPdfTheme, setTranscriptPdfTheme] = useState<'light' | 'dark'>(() => (
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    ));
    const pdfOptionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isPdfOptionsOpen) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (pdfOptionsRef.current?.contains(event.target as Node)) return;
            setIsPdfOptionsOpen(false);
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isPdfOptionsOpen]);

    useEffect(() => {
        if (!token || user?.role !== Role.STUDENT || selectedStudentId) return;
        api.org.getStudentByUserId(user.id, token)
            .then((student) => {
                if (student?.id) setSelectedStudentId(student.id);
            })
            .catch(console.error);
    }, [selectedStudentId, token, user]);

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    const studentsKey = token && searchTerm.length >= 2 && user?.role !== Role.STUDENT
        ? ['studentsSearch', { search: searchTerm, limit: 10 }] as const
        : null;
    const { data: studentsData } = useSWR<{ data: Student[] }>(studentsKey);

    const transcriptKey = token && selectedStudentId ? ['transcript', selectedStudentId, selectedCycleId] as const : null;
    const { data: transcriptResponse, isLoading, error, mutate } = useSWR<TranscriptResponse>(transcriptKey, async () => {
        const response = await api.transcripts.getStudentTranscript(selectedStudentId, token!, selectedCycleId || undefined);
        return response as unknown as TranscriptResponse;
    });

    const transcriptCycles = transcriptResponse?.transcript || [];
    const cumulativeAverage = transcriptCycles.length > 0
        ? Math.round((transcriptCycles.reduce((sum, cycle) => sum + (cycle.overallPercentage || 0), 0) / transcriptCycles.length) * 100) / 100
        : 0;
    const orgName = user?.orgName || PLATFORM_NAME;
    const logoUrl = getPublicUrl(user?.orgLogoUrl);
    const studentPhotoUrl = transcriptResponse
        ? getPublicUrl(transcriptResponse.student.avatarUrl, transcriptResponse.student.avatarUpdatedAt)
        : '';
    const transcriptTitle = selectedCycleId && transcriptCycles[0]
        ? getCyclePeriodLabel(transcriptCycles[0])
        : 'Cumulative Record';

    const handleDownloadPdf = async (theme: 'light' | 'dark' = transcriptPdfTheme) => {
        if (!transcriptResponse) return;
        setIsDownloadingPdf(true);
        try {
            const blob = await createTranscriptPdf({
                orgName,
                logoUrl,
                studentPhotoUrl,
                student: transcriptResponse.student,
                cycles: transcriptCycles,
                cumulativeAverage,
                summary: transcriptResponse.summary,
                theme,
            });
            downloadPdfBlob(blob, `${sanitizePdfFilename(transcriptResponse.student.name || 'student', 'student')}-transcript.pdf`);
            setIsPdfOptionsOpen(false);
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    return (
        <div className="flex h-full w-full flex-col space-y-4">
            <PageHeader
                title="Academic Transcripts"
                description={<>View and print academic reports by cycle or cumulative history. <DocsLink href="/docs/transcripts#transcript-calculation">Read transcript rules</DocsLink></>}
                icon={GraduationCap}
                actions={(
                    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end md:w-auto md:items-center">
                        {user?.role !== Role.STUDENT && (
                            <div className="w-full sm:w-72">
                                <div className="relative group">
                                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary">
                                        <Search className="h-4 w-4" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search students by name or reg #..."
                                        className="w-full rounded-md border border-border bg-input py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                    />
                                    {studentsData?.data && studentsData.data.length > 0 && searchTerm && (
                                        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                                            {studentsData.data.map((student) => (
                                                <button
                                                    key={student.id}
                                                    type="button"
                                                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-primary/10"
                                                    onClick={() => {
                                                        setSelectedStudentId(student.id);
                                                        setSearchTerm('');
                                                    }}
                                                >
                                                    <BrandIcon variant="user" size="sm" user={student.user} />
                                                    <div className="min-w-0">
                                                        <span className="block truncate font-semibold">{student.user?.name}</span>
                                                        <span className="block truncate text-xs text-muted-foreground">{student.registrationNumber || student.rollNumber}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="w-full sm:w-64">
                            <CustomSelect
                                value={selectedCycleId}
                                onChange={setSelectedCycleId}
                                options={[
                                    { value: '', label: 'All Cycles (Cumulative)' },
                                    ...(cyclesData?.data?.map((cycle) => ({ value: cycle.id, label: cycle.name })) || []),
                                ]}
                                placeholder="Select Cycle"
                            />
                        </div>

                        <Button
                            onClick={() => window.print()}
                            icon={Printer}
                            disabled={!transcriptResponse}
                            className="w-full sm:w-auto"
                        >
                            Print
                        </Button>
                        <div className="relative w-full sm:w-auto" ref={pdfOptionsRef}>
                            <Button
                                type="button"
                                onClick={() => setIsPdfOptionsOpen((open) => !open)}
                                icon={Download}
                                disabled={!transcriptResponse}
                                variant="secondary"
                                className="w-full sm:w-auto"
                                aria-expanded={isPdfOptionsOpen}
                            >
                                PDF
                            </Button>
                            {isPdfOptionsOpen && (
                                <div
                                    className="absolute right-0 z-50 mt-2 w-full min-w-72 rounded-lg border border-border/70 bg-card p-3 shadow-xl sm:w-80"
                                    onMouseDown={(event) => event.stopPropagation()}
                                >
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">PDF Theme</p>
                                            <p className="mt-1 text-xs font-medium text-muted-foreground">Choose the transcript style before downloading.</p>
                                        </div>
                                        <CustomSelect<'light' | 'dark'>
                                            value={transcriptPdfTheme}
                                            onChange={setTranscriptPdfTheme}
                                            options={[
                                                { value: 'light', label: 'Light PDF' },
                                                { value: 'dark', label: 'Dark PDF' },
                                            ]}
                                            placeholder="PDF theme"
                                        />
                                        <Button
                                            type="button"
                                            onClick={() => handleDownloadPdf(transcriptPdfTheme)}
                                            icon={Download}
                                            isLoading={isDownloadingPdf}
                                            loadingText="Downloading"
                                            className="w-full"
                                        >
                                            Download PDF
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            />

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #transcript-print-root,
                    #transcript-print-root * {
                        visibility: visible !important;
                    }
                    #transcript-print-root {
                        position: absolute !important;
                        inset: 0 auto auto 0 !important;
                        width: 100% !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        border: 0 !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: #111827 !important;
                    }
                    #transcript-print-root table {
                        page-break-inside: auto;
                    }
                    #transcript-print-root tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    #transcript-print-root section {
                        page-break-inside: avoid;
                    }
                }
            `}</style>

            <div
                id="transcript-print-root"
                className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-sm print:overflow-visible print:border-none print:p-0 print:shadow-none sm:p-6"
            >
                {isLoading && <Loading text="Generating Transcript..." />}
                {error && <ErrorState error={error} onRetry={() => mutate()} />}

                {!isLoading && !error && !transcriptResponse && (
                    <EmptyState
                        icon={GraduationCap}
                        title="Select a student"
                        description="Choose a student and academic cycle to view the transcript."
                        className="h-full min-h-96 print:hidden"
                    />
                )}

                {transcriptResponse && (
                    <div className="space-y-8">
                        <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-6">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-primary/10 text-xl font-black text-primary">
                                    {logoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={logoUrl} alt={`${orgName} logo`} className="h-full w-full rounded-full object-contain" />
                                    ) : (
                                        orgName.slice(0, 1).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-xl font-black text-foreground">{orgName}</p>
                                    <h2 className="mt-1 text-lg font-bold text-foreground">Official Academic Transcript</h2>
                                    <p className="text-muted-foreground">{transcriptTitle}</p>
                                </div>
                            </div>
                            <div className="hidden text-right text-xs font-semibold text-muted-foreground sm:block">
                                <p>Generated</p>
                                <p>{new Date().toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 rounded-lg bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-primary/10 text-sm font-black text-primary">
                                    {studentPhotoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={studentPhotoUrl}
                                            alt={`${transcriptResponse.student.name || 'Student'} photo`}
                                            className="h-full w-full rounded-full object-cover"
                                        />
                                    ) : (
                                        (transcriptResponse.student.name || 'S').slice(0, 1).toUpperCase()
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Student Name</p>
                                    <p className="truncate text-lg font-bold">{transcriptResponse.student.name || 'Unnamed Student'}</p>
                                    <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{transcriptResponse.student.email}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Registration</p>
                                <p className="text-lg font-bold">{transcriptResponse.student.registrationNumber || transcriptResponse.student.rollNumber || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Batch</p>
                                <p className="text-lg font-bold">{transcriptResponse.student.currentCohort?.name || 'Independent'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">CGPA</p>
                                <p className="text-lg font-bold text-primary">
                                    {transcriptResponse.summary?.cgpa ?? 0}
                                    <span className="text-sm text-muted-foreground"> / {transcriptResponse.summary?.gpaScale ?? 4}</span>
                                </p>
                            </div>
                        </div>

                        {transcriptCycles.length === 0 ? (
                            <EmptyState
                                icon={BookOpen}
                                title="No academic records found"
                                description="This student does not have transcript records for the selected period."
                            />
                        ) : (
                            <div className="space-y-6">
                                {transcriptCycles.map((cycle, cycleIndex) => {
                                    const sections = cycle.sections || [];
                                    return (
                                        <section key={cycle.academicCycle?.id || cycleIndex} className="overflow-hidden rounded-lg border border-border/70">
                                            <div className="flex flex-col gap-2 border-b border-border/60 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <h3 className="text-base font-black text-foreground">{getCyclePeriodLabel(cycle)}</h3>
                                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{cycle.policyName || transcriptResponse.summary?.policyName || 'GPA policy'} policy</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="info" size="sm">GPA {cycle.gpa ?? 0} / {cycle.gpaScale ?? transcriptResponse.summary?.gpaScale ?? 4}</Badge>
                                                    <Badge variant="neutral" size="sm">{cycle.totalCreditHours ?? 0} credits</Badge>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-230 table-fixed text-left text-sm">
                                                    <colgroup>
                                                        <col className="w-[25%]" />
                                                        <col className="w-[10%]" />
                                                        <col className="w-[13%]" />
                                                        <col className="w-[12%]" />
                                                        <col className="w-[12%]" />
                                                        <col className="w-[12%]" />
                                                        <col className="w-[13%]" />
                                                        <col className="w-[13%]" />
                                                    </colgroup>
                                                    <thead className="border-b border-border bg-card text-xs font-semibold uppercase text-muted-foreground">
                                                        <tr>
                                                            <th className="px-4 py-3">Course Section</th>
                                                            <th className="px-4 py-3 text-center">Credits</th>
                                                            <th className="px-4 py-3">Marks</th>
                                                            <th className="px-4 py-3 text-center">Raw %</th>
                                                            <th className="px-4 py-3 text-center">Final %</th>
                                                            <th className="px-4 py-3 text-center">Letter</th>
                                                            <th className="px-4 py-3 text-center">Grade Points</th>
                                                            <th className="px-4 py-3 text-center">Quality Points</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/20">
                                                        {sections.map((section) => {
                                                            const metrics = getSectionMetrics(section);
                                                            const sectionColor = getSectionColor(section.sectionColor);
                                                            return (
                                                                <tr
                                                                    key={section.sectionId}
                                                                    className={section.wasExcluded ? 'opacity-55' : ''}
                                                                    style={{ boxShadow: `inset 3px 0 0 ${sectionColor}` }}
                                                                >
                                                                    <td className="px-4 py-4" style={{ backgroundColor: `${sectionColor}0D` }}>
                                                                        <div className="font-semibold" style={{ color: sectionColor }}>{section.courseName}</div>
                                                                        <div className="text-xs font-semibold" style={{ color: `${sectionColor}CC` }}>{section.sectionName}</div>
                                                                        <div className="sr-only">{formatCourseSectionLabel({ courseName: section.courseName, sectionName: section.sectionName })}</div>
                                                                    </td>
                                                                    <td className="px-4 py-4 text-center font-bold">{metrics.creditHours}</td>
                                                                    <td className="px-4 py-4 font-mono text-sm font-bold">
                                                                        {metrics.marksObtained} / {metrics.totalMarks}
                                                                    </td>
                                                                    <td className="px-4 py-4 text-center font-bold">{metrics.rawPercentage}%</td>
                                                                    <td className="px-4 py-4 text-center font-bold text-primary">{metrics.weightedScore}%</td>
                                                                    <td className="px-4 py-4 text-center">
                                                                        <Badge variant={metrics.grade === 'N/A' ? 'neutral' : metrics.grade === 'F' ? 'error' : 'success'} size="sm">{metrics.grade}</Badge>
                                                                    </td>
                                                                    <td className="px-4 py-4 text-center font-bold">{metrics.gradePoints ?? 'N/A'}</td>
                                                                    <td className="px-4 py-4 text-center font-bold">{metrics.qualityPoints ?? 'N/A'}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {sections.length === 0 && (
                                                            <tr>
                                                                <td colSpan={8} className="py-8 text-center text-muted-foreground italic">
                                                                    No academic records found for this cycle.
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex justify-end border-t border-border/50 pt-6">
                            <div className="grid w-full gap-3 sm:max-w-3xl sm:grid-cols-4">
                                <div className="rounded-md border border-border bg-muted/20 p-3 text-right">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">CGPA</p>
                                    <p className="text-lg font-black text-primary">{transcriptResponse.summary?.cgpa ?? 0}</p>
                                </div>
                                <div className="rounded-md border border-border bg-muted/20 p-3 text-right">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Scale</p>
                                    <p className="text-lg font-black">{transcriptResponse.summary?.gpaScale ?? 4}</p>
                                </div>
                                <div className="rounded-md border border-border bg-muted/20 p-3 text-right">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Credits</p>
                                    <p className="text-lg font-black">{transcriptResponse.summary?.totalCreditHours ?? 0}</p>
                                </div>
                                <div className="rounded-md border border-border bg-muted/20 p-3 text-right">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">Policy</p>
                                    <p className="truncate text-lg font-black">{transcriptResponse.summary?.policyName || 'GPA Policy'}</p>
                                </div>
                                <p className="text-right text-xs font-semibold text-muted-foreground sm:col-span-4">
                                    Letter grades and grade points come from the cycle GPA policy. <DocsLink href="/docs/transcripts#transcript-columns">Column guide</DocsLink>
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
