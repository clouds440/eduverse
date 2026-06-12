'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Award, FileText, Search, TrendingUp, Trophy } from 'lucide-react';
import { FinalGradeResponse } from '@/types';
import { Card } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { getSectionColor, getSectionSurfaceStyle, getSectionTintStyle } from '@/lib/utils';

function formatPercent(value: number) {
    return `${Math.round(Number(value || 0) * 10) / 10}%`;
}

interface GradesProps {
    grades: FinalGradeResponse[];
    transcriptHref?: string;
    showSectionSelector?: boolean;
}

export default function Grades({ grades, transcriptHref = '/transcripts', showSectionSelector = false }: GradesProps) {
    const [search, setSearch] = useState('');
    const [selectedSectionId, setSelectedSectionId] = useState('');

    const sectionOptions = useMemo(() => (
        grades.map((grade) => ({
            value: grade.sectionId,
            label: `${grade.courseName} - ${grade.sectionName}`,
        }))
    ), [grades]);

    const filteredGrades = useMemo(() => {
        const query = search.trim().toLowerCase();
        const scopedGrades = selectedSectionId
            ? grades.filter((grade) => grade.sectionId === selectedSectionId)
            : grades;
        if (!query) return scopedGrades;
        return scopedGrades.filter((grade) => (
            grade.courseName.toLowerCase().includes(query)
            || grade.sectionName.toLowerCase().includes(query)
            || grade.letterGrade?.toLowerCase().includes(query)
        ));
    }, [grades, search, selectedSectionId]);

    const averageGrade = grades.length > 0
        ? grades.reduce((acc, grade) => acc + (Number(grade.finalPercentage) || 0), 0) / grades.length
        : 0;
    const strongestGrade = grades.length > 0
        ? [...grades].sort((a, b) => Number(b.finalPercentage || 0) - Number(a.finalPercentage || 0))[0]
        : null;
    const attentionCount = grades.filter((grade) => Number(grade.finalPercentage || 0) < 50).length;
    const gradedAssessments = grades.reduce((sum, grade) => (
        sum + (grade.assessments || []).filter((assessment) => assessment.status !== 'NOT_GRADED').length
    ), 0);
    const totalAssessments = grades.reduce((sum, grade) => sum + (grade.assessments || []).length, 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card padding="sm" hoverable={false}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Average</p>
                            <p className="mt-2 text-3xl font-black text-foreground">{formatPercent(averageGrade)}</p>
                        </div>
                        <Trophy className="h-5 w-5 text-primary" />
                    </div>
                </Card>
                <Card padding="sm" hoverable={false}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Graded Work</p>
                            <p className="mt-2 text-3xl font-black text-foreground">{gradedAssessments}/{totalAssessments}</p>
                        </div>
                        <Award className="h-5 w-5 text-success" />
                    </div>
                </Card>
                <Card padding="sm" hoverable={false}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Strongest</p>
                            <p className="mt-2 truncate text-lg font-black text-foreground">{strongestGrade?.courseName || 'No grades yet'}</p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-info" />
                    </div>
                </Card>
                <Card padding="sm" hoverable={false}>
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Needs Attention</p>
                            <p className="mt-2 text-3xl font-black text-foreground">{attentionCount}</p>
                        </div>
                        <Search className="h-5 w-5 text-warning" />
                    </div>
                </Card>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-black text-foreground">Course Results</h2>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {grades.length} {grades.length === 1 ? 'section' : 'sections'} with grade records
                    </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-80">
                    {showSectionSelector && (
                        <CustomSelect
                            value={selectedSectionId}
                            onChange={setSelectedSectionId}
                            options={[
                                { value: '', label: 'All courses' },
                                ...sectionOptions,
                            ]}
                            placeholder="Select course"
                            searchable
                        />
                    )}
                    <SearchBar
                        placeholder="Search grades..."
                        value={search}
                        onChange={setSearch}
                    />
                </div>
            </div>

            {filteredGrades.length === 0 ? (
                <EmptyState
                    icon={Trophy}
                    title={grades.length === 0 ? 'No released grades' : 'No grades found'}
                    description={grades.length === 0 ? 'Published and finalized grades will appear here when available.' : 'Try another course, section, or grade.'}
                    className="min-h-80"
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {filteredGrades.map((grade, index) => {
                        const sectionColor = getSectionColor(grade.sectionColor);
                        const sectionPanelStyle = getSectionSurfaceStyle(grade.sectionColor, '0C', '38');
                        const sectionBadgeStyle = getSectionTintStyle(grade.sectionColor);
                        const finalPercentage = Number(grade.finalPercentage || 0);
                        return (
                            <Card
                                key={`${grade.sectionId}-${index}`}
                                padding="md"
                                hoverable={false}
                                className="border shadow-sm"
                                style={{
                                    ...getSectionSurfaceStyle(grade.sectionColor, '10', '55'),
                                    color: sectionColor,
                                    boxShadow: `inset 3px 0 0 ${sectionColor}`,
                                }}
                            >
                                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border text-lg font-black"
                                            style={sectionBadgeStyle}
                                        >
                                            {grade.letterGrade || '-'}
                                        </div>
                                        <div className="min-w-0">
                                            <CourseSectionLabel
                                                courseName={grade.courseName}
                                                sectionName={grade.sectionName}
                                                color={sectionColor}
                                                variant="stacked"
                                                as="h3"
                                                className="text-base font-black leading-tight"
                                            />
                                            <p className="mt-1 text-xs font-semibold opacity-80" style={{ color: sectionColor }}>
                                                {(grade.assessments || []).filter((assessment) => assessment.status !== 'NOT_GRADED').length} / {(grade.assessments || []).length} assessments graded
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full shrink-0 sm:w-36 sm:text-right">
                                        <p className="text-2xl font-black" style={{ color: sectionColor }}>{formatPercent(finalPercentage)}</p>
                                        <div className="mt-2 h-2 overflow-hidden rounded-full border" style={sectionPanelStyle}>
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${Math.min(100, Math.max(0, finalPercentage))}%`, backgroundColor: sectionColor }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Link href={transcriptHref} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm font-black text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30">
                <FileText className="h-4 w-4 text-primary" />
                Open Official Transcript
            </Link>
        </div>
    );
}
