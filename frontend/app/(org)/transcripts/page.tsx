'use client';

import { useEffect, useState } from 'react';
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
import { BookOpen, Download, GraduationCap, Printer, Search } from 'lucide-react';
import { getPublicUrl } from '@/lib/utils';
import { PLATFORM_NAME } from '@/lib/constants';

interface TranscriptStudent {
    id: string;
    name: string | null;
    email: string;
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
}

interface TranscriptCycleSection {
    sectionId: string;
    sectionName: string;
    courseName: string;
    enrollmentType: string;
    wasExcluded: boolean;
    grades?: TranscriptAssessmentGrade[];
    totalPercentage: number;
}

interface TranscriptCycle {
    academicCycle: { id: string; name: string; startDate?: string; endDate?: string } | null;
    cohortName: string | null;
    sections?: TranscriptCycleSection[];
    overallPercentage: number;
}

interface TranscriptResponse {
    student: TranscriptStudent;
    transcript?: TranscriptCycle[];
}

interface PdfLine {
    text: string;
    x: number;
    y: number;
    size?: number;
    font?: 'regular' | 'bold';
    color?: string;
}

interface PdfRect {
    x: number;
    y: number;
    width: number;
    height: number;
    fill?: string;
    stroke?: string;
}

interface PdfPage {
    lines: PdfLine[];
    rects: PdfRect[];
}

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 42;
const PASS_MARK = 50;

function escapePdfText(value: string) {
    return value
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function escapePdfName(value: string) {
    return value.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'transcript';
}

function wrapText(value: string, maxChars: number) {
    const words = value.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';

    words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    });

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
}

function roundScore(value: number) {
    return Math.round(value * 100) / 100;
}

function getSectionMetrics(section: TranscriptCycleSection) {
    const grades = section.grades || [];
    const marksObtained = roundScore(grades.reduce((sum, grade) => sum + Number(grade.marksObtained || 0), 0));
    const totalMarks = roundScore(grades.reduce((sum, grade) => sum + Number(grade.totalMarks || 0), 0));
    const totalWeight = roundScore(grades.reduce((sum, grade) => sum + Number(grade.weightage || 0), 0));
    const rawPercentage = totalMarks > 0 ? roundScore((marksObtained / totalMarks) * 100) : 0;
    const weightedScore = roundScore(section.totalPercentage || 0);
    const status = getAcademicStatus(section, grades.length, weightedScore);
    const grade = section.wasExcluded || grades.length === 0 ? 'N/A' : getLetterGrade(weightedScore);

    return {
        assessmentCount: grades.length,
        marksObtained,
        totalMarks,
        totalWeight,
        rawPercentage,
        weightedScore,
        grade,
        status,
    };
}

function getLetterGrade(score: number) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
}

function getAcademicStatus(section: TranscriptCycleSection, assessmentCount: number, weightedScore: number) {
    if (section.wasExcluded) return 'Excluded';
    if (assessmentCount === 0) return 'No grades';
    return weightedScore >= PASS_MARK ? 'Pass' : 'Fail';
}

function getStatusVariant(status: string): 'success' | 'error' | 'warning' | 'neutral' {
    if (status === 'Pass') return 'success';
    if (status === 'Fail') return 'error';
    if (status === 'Excluded') return 'warning';
    return 'neutral';
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

function createTranscriptPdf({
    orgName,
    student,
    cycles,
    cumulativeAverage,
}: {
    orgName: string;
    student: TranscriptStudent;
    cycles: TranscriptCycle[];
    cumulativeAverage: number;
}) {
    const pages: PdfPage[] = [];
    let page: PdfPage;
    let y = PDF_PAGE_HEIGHT - PDF_MARGIN;

    const addPage = () => {
        page = { lines: [], rects: [] };
        pages.push(page);
        y = PDF_PAGE_HEIGHT - PDF_MARGIN;
    };

    const drawText = (text: string, x: number, textY: number, size = 10, font: 'regular' | 'bold' = 'regular', color = '0 0 0') => {
        page.lines.push({ text, x, y: textY, size, font, color });
    };

    const drawRect = (rect: PdfRect) => {
        page.rects.push(rect);
    };

    const ensureSpace = (height: number) => {
        if (y - height >= PDF_MARGIN) return;
        addPage();
        drawDocumentHeader(false);
    };

    const drawDocumentHeader = (fullHeader: boolean) => {
        drawRect({ x: PDF_MARGIN, y: y - 38, width: 38, height: 38, fill: '0.16 0.32 0.75' });
        drawText(orgName.slice(0, 1).toUpperCase(), PDF_MARGIN + 13, y - 25, 16, 'bold', '1 1 1');
        drawText(orgName, PDF_MARGIN + 50, y - 12, 16, 'bold');
        drawText('Official Academic Transcript', PDF_MARGIN + 50, y - 29, 11);
        drawText(new Date().toLocaleDateString(), PDF_PAGE_WIDTH - PDF_MARGIN - 78, y - 16, 9);
        y -= fullHeader ? 62 : 52;
    };

    addPage();
    drawDocumentHeader(true);

    drawRect({ x: PDF_MARGIN, y: y - 68, width: PDF_PAGE_WIDTH - PDF_MARGIN * 2, height: 68, stroke: '0.82 0.86 0.92' });
    drawText('Student', PDF_MARGIN + 14, y - 20, 8, 'bold');
    drawText(student.name || 'Unnamed Student', PDF_MARGIN + 14, y - 38, 13, 'bold');
    drawText(student.email || 'No email recorded', PDF_MARGIN + 14, y - 54, 9);
    drawText(`Cohort: ${student.currentCohort?.name || 'Independent'}`, PDF_MARGIN + 220, y - 22, 10);
    drawText(`Registration: ${student.registrationNumber || student.rollNumber || 'N/A'}`, PDF_MARGIN + 220, y - 40, 10);
    drawText(`Overall Average: ${cumulativeAverage}%`, PDF_MARGIN + 410, y - 31, 11, 'bold');
    y -= 92;

    if (cycles.length === 0) {
        drawText('No academic records found for the selected period.', PDF_MARGIN, y, 12, 'bold');
    }

    cycles.forEach((cycle) => {
        const sections = cycle.sections || [];
        ensureSpace(78);
        drawRect({ x: PDF_MARGIN, y: y - 30, width: PDF_PAGE_WIDTH - PDF_MARGIN * 2, height: 30, fill: '0.93 0.95 1' });
        drawText(getCyclePeriodLabel(cycle), PDF_MARGIN + 10, y - 19, 11, 'bold');
        drawText(`${cycle.cohortName || 'No cohort'} | ${cycle.overallPercentage || 0}% average`, PDF_PAGE_WIDTH - PDF_MARGIN - 190, y - 19, 9);
        y -= 42;

        drawText('Course / Section', PDF_MARGIN, y, 8, 'bold');
        drawText('Assess', PDF_MARGIN + 178, y, 8, 'bold');
        drawText('Marks', PDF_MARGIN + 220, y, 8, 'bold');
        drawText('Raw %', PDF_MARGIN + 292, y, 8, 'bold');
        drawText('Weight', PDF_MARGIN + 342, y, 8, 'bold');
        drawText('W.Score', PDF_MARGIN + 392, y, 8, 'bold');
        drawText('Grade', PDF_MARGIN + 455, y, 8, 'bold');
        drawText('Status', PDF_MARGIN + 498, y, 8, 'bold');
        y -= 12;
        drawRect({ x: PDF_MARGIN, y, width: PDF_PAGE_WIDTH - PDF_MARGIN * 2, height: 0.5, fill: '0.82 0.86 0.92' });
        y -= 10;

        if (sections.length === 0) {
            ensureSpace(24);
            drawText('No academic records found for this cycle.', PDF_MARGIN, y, 10);
            y -= 28;
        }

        sections.forEach((section) => {
            const courseLines = wrapText(`${section.courseName} - ${section.sectionName}`, 28).slice(0, 2);
            const metrics = getSectionMetrics(section);
            const rowHeight = Math.max(34, courseLines.length * 12 + 12);
            ensureSpace(rowHeight + 8);

            courseLines.forEach((line, index) => {
                drawText(line, PDF_MARGIN, y - (index * 12), 9, index === 0 ? 'bold' : 'regular');
            });
            drawText(String(metrics.assessmentCount), PDF_MARGIN + 178, y, 9);
            drawText(`${metrics.marksObtained}/${metrics.totalMarks}`, PDF_MARGIN + 220, y, 9);
            drawText(`${metrics.rawPercentage}%`, PDF_MARGIN + 292, y, 9);
            drawText(`${metrics.totalWeight}%`, PDF_MARGIN + 342, y, 9);
            drawText(`${metrics.weightedScore}%`, PDF_MARGIN + 392, y, 9, 'bold');
            drawText(metrics.grade, PDF_MARGIN + 455, y, 9, 'bold');
            drawText(metrics.status, PDF_MARGIN + 498, y, 9);
            y -= rowHeight;
            drawRect({ x: PDF_MARGIN, y: y + 6, width: PDF_PAGE_WIDTH - PDF_MARGIN * 2, height: 0.4, fill: '0.88 0.90 0.94' });
        });

        y -= 14;
    });

    ensureSpace(44);
    drawRect({ x: PDF_PAGE_WIDTH - PDF_MARGIN - 190, y: y - 36, width: 190, height: 36, stroke: '0.82 0.86 0.92' });
    drawText(`Overall Average: ${cumulativeAverage}%`, PDF_PAGE_WIDTH - PDF_MARGIN - 178, y - 16, 11, 'bold');
    drawText(`Pass mark: ${PASS_MARK}% | A+ 90, A 80, B 70, C 60, D 50`, PDF_MARGIN, y - 16, 8);

    return buildPdfBlob(pages);
}

function buildPdfBlob(pages: PdfPage[]) {
    const objects: string[] = [];
    const addObject = (content: string) => {
        objects.push(content);
        return objects.length;
    };

    const catalogId = addObject('');
    const pagesId = addObject('');
    const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageIds: number[] = [];

    pages.forEach((pdfPage) => {
        const commands: string[] = [];
        pdfPage.rects.forEach((rect) => {
            if (rect.fill) {
                commands.push(`${rect.fill} rg ${rect.x} ${rect.y} ${rect.width} ${rect.height} re f`);
            }
            if (rect.stroke) {
                commands.push(`${rect.stroke} RG ${rect.x} ${rect.y} ${rect.width} ${rect.height} re S`);
            }
        });
        pdfPage.lines.forEach((line) => {
            const fontName = line.font === 'bold' ? 'F2' : 'F1';
            commands.push(`BT /${fontName} ${line.size || 10} Tf ${line.color || '0 0 0'} rg ${line.x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`);
        });
        const stream = commands.join('\n');
        const streamLength = new TextEncoder().encode(stream).length;
        const contentId = addObject(`<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`);
        const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
        pageIds.push(pageId);
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    const chunks = ['%PDF-1.4\n'];
    const offsets: number[] = [0];
    objects.forEach((object, index) => {
        offsets.push(chunks.join('').length);
        chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
    });
    const xrefOffset = chunks.join('').length;
    chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach((offset) => {
        chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
    });
    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(chunks, { type: 'application/pdf' });
}

export default function TranscriptsPage() {
    const { token, user } = useAuth();
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedCycleId, setSelectedCycleId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

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
    const transcriptTitle = selectedCycleId && transcriptCycles[0]
        ? getCyclePeriodLabel(transcriptCycles[0])
        : 'Cumulative Record';

    const handleDownloadPdf = () => {
        if (!transcriptResponse) return;
    const blob = createTranscriptPdf({
        orgName,
        student: transcriptResponse.student,
        cycles: transcriptCycles,
        cumulativeAverage,
    });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${escapePdfName(transcriptResponse.student.name || 'student')}-transcript.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    return (
        <div className="flex h-full w-full flex-col space-y-4">
            <PageHeader
                title="Academic Transcripts"
                description="View and print student academic reports by cycle or cumulative history."
                icon={GraduationCap}
                actions={(
                    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end md:w-auto md:items-center">
                        {user?.role !== Role.STUDENT && (
                            <div className="w-full sm:w-72">
                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Find Student
                                </label>
                                <div className="relative group">
                                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary">
                                        <Search className="h-4 w-4" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search by name or reg #..."
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
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Academic Cycle
                            </label>
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
                        <Button
                            onClick={handleDownloadPdf}
                            icon={Download}
                            disabled={!transcriptResponse}
                            variant="secondary"
                            className="w-full sm:w-auto"
                        >
                            PDF
                        </Button>
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
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Student Name</p>
                                <p className="text-lg font-bold">{transcriptResponse.student.name || 'Unnamed Student'}</p>
                                <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">{transcriptResponse.student.email}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Registration</p>
                                <p className="text-lg font-bold">{transcriptResponse.student.registrationNumber || transcriptResponse.student.rollNumber || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Current Cohort</p>
                                <p className="text-lg font-bold">{transcriptResponse.student.currentCohort?.name || 'Independent'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Overall Average</p>
                                <p className="text-lg font-bold text-primary">{cumulativeAverage}%</p>
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
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-240 text-left text-sm">
                                                    <thead className="border-b border-border bg-card text-xs font-semibold uppercase text-muted-foreground">
                                                        <tr>
                                                            <th className="px-4 py-3">Course Section</th>
                                                            <th className="px-4 py-3">Assessments</th>
                                                            <th className="px-4 py-3">Marks</th>
                                                            <th className="px-4 py-3 text-center">Raw %</th>
                                                            <th className="px-4 py-3 text-center">Weight</th>
                                                            <th className="px-4 py-3 text-center">Weighted Score</th>
                                                            <th className="px-4 py-3 text-center">Grade</th>
                                                            <th className="px-4 py-3 text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/20">
                                                        {sections.map((section) => {
                                                            const metrics = getSectionMetrics(section);
                                                            return (
                                                                <tr key={section.sectionId} className={section.wasExcluded ? 'opacity-55' : ''}>
                                                                    <td className="px-4 py-4">
                                                                        <div className="font-semibold text-foreground">{section.courseName}</div>
                                                                        <div className="text-xs text-muted-foreground">{section.sectionName}</div>
                                                                    </td>
                                                                    <td className="px-4 py-4">
                                                                        <div className="font-bold text-foreground">{metrics.assessmentCount}</div>
                                                                        <div className="text-xs font-semibold text-muted-foreground">recorded</div>
                                                                    </td>
                                                                    <td className="px-4 py-4 font-mono text-sm font-bold">
                                                                        {metrics.marksObtained} / {metrics.totalMarks}
                                                                    </td>
                                                                    <td className="px-4 py-4 text-center font-bold">{metrics.rawPercentage}%</td>
                                                                    <td className="px-4 py-4 text-center font-bold">{metrics.totalWeight}%</td>
                                                                    <td className="px-4 py-4 text-center font-bold text-primary">{metrics.weightedScore}%</td>
                                                                    <td className="px-4 py-4 text-center">
                                                                        <Badge variant={metrics.grade === 'N/A' ? 'neutral' : metrics.grade === 'F' ? 'error' : 'success'} size="sm">{metrics.grade}</Badge>
                                                                    </td>
                                                                    <td className="px-4 py-4 text-center">
                                                                        <Badge variant={getStatusVariant(metrics.status)} size="sm">
                                                                            {metrics.status}
                                                                        </Badge>
                                                                    </td>
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
                            <div className="w-full max-w-xl space-y-2">
                                <p className="text-right text-xs font-semibold text-muted-foreground">
                                    Pass mark: {PASS_MARK}% | Grade scale: A+ 90+, A 80-89, B 70-79, C 60-69, D 50-59, F below 50
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
