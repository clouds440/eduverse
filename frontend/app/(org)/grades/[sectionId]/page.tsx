'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, BookOpen, Download, GraduationCap, Printer, RefreshCw, Settings2, Users } from 'lucide-react';
import { GradeStatus, type BadgeVariant, type SectionGradebookCell, type SectionGradebookResponse, type SectionGradebookStudentRow } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { PageControls } from '@/components/ui/FilterDrawerToolbar';
import { PageHeader, PageShell, ResourcePanel } from '@/components/ui/PageShell';
import { SearchBar } from '@/components/ui/SearchBar';
import { BrandIcon } from '@/components/ui/Brand';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { useAuth } from '@/context/AuthContext';
import { PLATFORM_NAME } from '@/lib/constants';
import { fuzzySearchScore } from '@/lib/fuzzySearch';
import { downloadPdfBlob, sanitizePdfFilename } from '@/lib/pdf/core';
import { createSectionGradesPdf } from '@/lib/pdf/sectionGrades';
import { getCourseSectionLabelParts, getPublicUrl, getSectionColor } from '@/lib/utils';

type StatusFilter = 'ALL' | 'MISSING' | GradeStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'MISSING', label: 'Missing grades' },
    { value: GradeStatus.DRAFT, label: 'Draft' },
    { value: GradeStatus.PUBLISHED, label: 'Published' },
    { value: GradeStatus.FINALIZED, label: 'Finalized' },
];

function formatNumber(value?: number | null) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
    return Number(value).toFixed(Number.isInteger(Number(value)) ? 0 : 1);
}

function getStatusVariant(status?: GradeStatus | null): BadgeVariant {
    if (status === GradeStatus.FINALIZED) return 'success';
    if (status === GradeStatus.PUBLISHED) return 'info';
    if (status === GradeStatus.DRAFT) return 'warning';
    return 'neutral';
}

function getStatusLabel(status?: GradeStatus | null) {
    if (!status) return 'Missing';
    return status.charAt(0) + status.slice(1).toLowerCase();
}

function getAssessmentCell(row: SectionGradebookStudentRow, assessmentId: string) {
    return row.grades.find((grade) => grade.assessmentId === assessmentId);
}

function GradeCell({ cell }: { cell?: SectionGradebookCell }) {
    if (!cell || cell.marksObtained === null || cell.marksObtained === undefined) {
        return (
            <div className="min-w-0 space-y-1">
                <Badge variant="neutral" size="sm">Missing</Badge>
                <p className="truncate text-xs text-muted-foreground">No marks entered</p>
            </div>
        );
    }

    return (
        <div className="min-w-0 space-y-1">
            <p className="truncate font-black text-foreground">
                {formatNumber(cell.marksObtained)}
                <span className="text-xs font-semibold text-muted-foreground"> / {formatNumber(cell.totalMarks)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={getStatusVariant(cell.status)} size="sm">{getStatusLabel(cell.status)}</Badge>
                <span className="text-xs font-semibold text-muted-foreground">{formatNumber(cell.percentage)}%</span>
            </div>
        </div>
    );
}

function PrintableGradebook({ gradebook }: { gradebook: SectionGradebookResponse }) {
    return (
        <div className="hidden print:block">
            <div className="mb-5 border-b border-gray-300 pb-4">
                <p className="text-lg font-black text-gray-950">{gradebook.section.course?.name || 'Section'} - {gradebook.section.name}</p>
                <p className="text-sm font-semibold text-gray-600">{gradebook.summary.studentCount} students | {gradebook.summary.assessmentCount} assessments | Average {formatNumber(gradebook.summary.averageWeightedPercentage)}%</p>
            </div>
            <table className="w-full border-collapse text-left text-[10px] text-gray-950">
                <thead>
                    <tr>
                        <th className="border border-gray-300 px-2 py-1">Student</th>
                        {gradebook.assessments.map((assessment) => (
                            <th key={assessment.id} className="border border-gray-300 px-2 py-1">
                                {assessment.title}<br />
                                <span className="font-normal">{assessment.weightage}%</span>
                            </th>
                        ))}
                        <th className="border border-gray-300 px-2 py-1">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {gradebook.students.map((row) => (
                        <tr key={row.student.id}>
                            <td className="border border-gray-300 px-2 py-1 align-top">
                                <strong>{row.student.user?.name || 'Unnamed student'}</strong><br />
                                {row.student.registrationNumber || row.student.rollNumber || 'No registration'}
                            </td>
                            {gradebook.assessments.map((assessment) => {
                                const cell = getAssessmentCell(row, assessment.id);
                                return (
                                    <td key={assessment.id} className="border border-gray-300 px-2 py-1 align-top">
                                        {cell?.marksObtained === null || cell?.marksObtained === undefined
                                            ? 'Missing'
                                            : `${formatNumber(cell.marksObtained)} / ${formatNumber(cell.totalMarks)}`}
                                        <br />
                                        <span>{getStatusLabel(cell?.status)}</span>
                                    </td>
                                );
                            })}
                            <td className="border border-gray-300 px-2 py-1 align-top">
                                <strong>{formatNumber(row.summary.weightedPercentage)}%</strong><br />
                                {row.summary.letterGrade} | {row.summary.gradedAssessments}/{gradebook.assessments.length}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function SectionGradesPage() {
    const params = useParams<{ sectionId: string }>();
    const sectionId = params.sectionId;
    const { token, user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const gradebookKey = token && sectionId ? ['section-gradebook', sectionId] as const : null;
    const { data: gradebook, isLoading, error, mutate } = useSWR<SectionGradebookResponse>(gradebookKey);

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim();
        return (gradebook?.students || []).filter((row) => {
            const matchesSearch = !term || fuzzySearchScore(term, [
                row.student.user?.name,
                row.student.user?.email,
                row.student.registrationNumber,
                row.student.rollNumber,
            ]) > 0;

            const matchesStatus = statusFilter === 'ALL'
                || row.grades.some((grade) => statusFilter === 'MISSING' ? !grade.status : grade.status === statusFilter);

            return matchesSearch && matchesStatus;
        });
    }, [gradebook?.students, searchTerm, statusFilter]);

    const columns = useMemo<Column<SectionGradebookStudentRow>[]>(() => {
        const assessmentColumns = (gradebook?.assessments || []).map((assessment): Column<SectionGradebookStudentRow> => ({
            header: `${assessment.title} (${assessment.weightage}%)`,
            accessor: (row) => <GradeCell cell={getAssessmentCell(row, assessment.id)} />,
            width: 170,
        }));

        return [
            {
                header: 'Student',
                accessor: (row) => (
                    <div className="flex min-w-0 items-center gap-3">
                        <BrandIcon variant="user" size="sm" user={row.student.user} className="h-8 w-8 shrink-0" />
                        <div className="min-w-0">
                            <p className="truncate font-bold text-foreground">{row.student.user?.name || 'Unnamed student'}</p>
                            <p className="truncate text-xs text-muted-foreground">{row.student.registrationNumber || row.student.rollNumber || 'No registration'}</p>
                        </div>
                    </div>
                ),
                width: 260,
            },
            ...assessmentColumns,
            {
                header: 'Final %',
                accessor: (row) => (
                    <div className="min-w-0">
                        <p className="font-black text-primary">{formatNumber(row.summary.weightedPercentage)}%</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(row.summary.marksObtained)} / {formatNumber(row.summary.totalMarks)}</p>
                    </div>
                ),
                width: 130,
            },
            {
                header: 'Letter',
                accessor: (row) => <Badge variant={row.summary.letterGrade === 'N/A' ? 'neutral' : row.summary.letterGrade === 'F' ? 'error' : 'success'} size="sm">{row.summary.letterGrade}</Badge>,
                badge: true,
                width: 110,
            },
            {
                header: 'Progress',
                accessor: (row) => `${row.summary.gradedAssessments}/${gradebook?.assessments.length || 0} graded`,
                width: 130,
            },
        ];
    }, [gradebook?.assessments]);

    const sectionColor = getSectionColor(gradebook?.section.color);
    const labelParts = gradebook ? getCourseSectionLabelParts({ courseName: gradebook.section.course?.name, sectionName: gradebook.section.name }) : null;
    const logoUrl = getPublicUrl(user?.orgLogoUrl);
    const orgName = user?.orgName || PLATFORM_NAME;

    const handleDownloadPdf = async () => {
        if (!gradebook) return;
        setIsDownloadingPdf(true);
        try {
            const blob = await createSectionGradesPdf({ orgName, logoUrl, gradebook });
            const filename = sanitizePdfFilename(`${gradebook.section.course?.name || 'section'}-${gradebook.section.name}-grades`, 'section-grades');
            downloadPdfBlob(blob, `${filename}.pdf`);
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    return (
        <PageShell>
            <PageHeader
                title={labelParts?.inlineLabel || 'Section Grades'}
                description={<>Review every student&apos;s marks across all assessments in this section. <DocsLink href="/docs/gradebook#grades-page">Read grade docs</DocsLink></>}
                icon={GraduationCap}
                breadcrumbs={[
                    { label: 'Organization' },
                    { label: 'Academics' },
                    { label: 'Grades', href: '/grades' },
                    { label: labelParts?.inlineLabel || 'Section' },
                ]}
                meta={gradebook ? <Badge variant="neutral" size="sm">{gradebook.summary.studentCount} students</Badge> : undefined}
                actions={(
                    <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
                        <Link href="/grades" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Grades
                        </Link>
                        {sectionId && (
                            <Link href={`/sections/${sectionId}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-primary/35 hover:bg-muted/70">
                                <Settings2 className="h-4 w-4" aria-hidden="true" />
                                Control Panel
                            </Link>
                        )}
                        <Button type="button" variant="secondary" icon={Printer} disabled={!gradebook} onClick={() => window.print()}>
                            Print
                        </Button>
                        <Button type="button" icon={Download} disabled={!gradebook} isLoading={isDownloadingPdf} loadingText="PDF" onClick={handleDownloadPdf}>
                            PDF
                        </Button>
                    </div>
                )}
            />

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #section-grades-print-root, #section-grades-print-root * { visibility: visible !important; }
                    #section-grades-print-root {
                        position: absolute !important;
                        inset: 0 auto auto 0 !important;
                        width: 100% !important;
                        padding: 0 !important;
                        border: 0 !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: #111827 !important;
                    }
                    #section-grades-print-root tr { page-break-inside: avoid; }
                }
            `}</style>

            <ResourcePanel className="overflow-y-auto">
                {isLoading ? (
                    <Loading text="Loading section grades..." />
                ) : error ? (
                    <ErrorState error={error} onRetry={() => mutate()} />
                ) : !gradebook ? (
                    <EmptyState icon={BookOpen} title="Section not found" description="The gradebook for this section could not be loaded." className="min-h-72" />
                ) : (
                    <div id="section-grades-print-root" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
                        <div className="mb-4 grid gap-3 print:hidden md:grid-cols-4">
                            <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm" style={{ boxShadow: `inset 3px 0 0 ${sectionColor}` }}>
                                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Students</p>
                                <p className="mt-2 text-2xl font-black text-foreground">{gradebook.summary.studentCount}</p>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Assessments</p>
                                <p className="mt-2 text-2xl font-black text-foreground">{gradebook.summary.assessmentCount}</p>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Average</p>
                                <p className="mt-2 text-2xl font-black text-primary">{formatNumber(gradebook.summary.averageWeightedPercentage)}%</p>
                            </div>
                            <div className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
                                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Missing</p>
                                <p className="mt-2 text-2xl font-black text-foreground">{gradebook.summary.missingGradeCount}</p>
                            </div>
                        </div>

                        <div className="mb-3 print:hidden">
                            <PageControls
                                drawerLabel="Gradebook filters"
                                leading={<SearchBar placeholder="Search students..." value={searchTerm} onChange={setSearchTerm} mobileMode="expandable" />}
                                actions={(
                                    <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => mutate()}>
                                        Refresh
                                    </Button>
                                )}
                                renderFilters={() => (
                                    <CustomSelect<StatusFilter>
                                        value={statusFilter}
                                        onChange={setStatusFilter}
                                        options={STATUS_OPTIONS}
                                    />
                                )}
                            />
                        </div>

                        {gradebook.assessments.length === 0 ? (
                            <EmptyState icon={BookOpen} title="No assessments yet" description="Create assessments in the section control panel before grades can appear here." className="min-h-72 print:hidden" />
                        ) : filteredRows.length === 0 ? (
                            <EmptyState icon={Users} title="No students found" description="Try another search or status filter." className="min-h-72 print:hidden" />
                        ) : (
                            <div className="print:hidden">
                                <DataTable
                                    data={filteredRows}
                                    columns={columns}
                                    keyExtractor={(row) => row.student.id}
                                    currentPage={1}
                                    totalPages={1}
                                    totalResults={filteredRows.length}
                                    pageSize={Math.max(filteredRows.length, 10)}
                                    onPageChange={() => { }}
                                    showSerialNumber
                                    tableLayout="auto"
                                    maxHeight="calc(100vh - 330px)"
                                    emptyTitle="No grade rows"
                                    emptyDescription="No students match the current filters."
                                />
                            </div>
                        )}

                        <PrintableGradebook gradebook={gradebook} />
                    </div>
                )}
            </ResourcePanel>
        </PageShell>
    );
}
