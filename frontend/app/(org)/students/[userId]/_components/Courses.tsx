'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, MapPinHouse, Book, CalendarDays, FileText, CheckCircle } from 'lucide-react';
import { Assessment, GradeStatus, Section } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { getSectionColor, getSectionSurfaceStyle, getSectionTintStyle } from '@/lib/utils';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatSectionSchedule(section: Section) {
    const firstSchedule = section.schedules?.[0];
    if (!firstSchedule) return 'No schedule set';

    const day = WEEKDAYS[firstSchedule.day] || 'Scheduled';
    const room = firstSchedule.room || section.room;
    return `${day} ${firstSchedule.startTime} - ${firstSchedule.endTime}${room ? ` • ${room}` : ''}`;
}

function isCompletedAssessment(assessment: Assessment) {
    const grade = assessment.grades?.[0];
    return Boolean(
        assessment.submissions?.length
        || (grade && (grade.status === GradeStatus.PUBLISHED || grade.status === GradeStatus.FINALIZED)),
    );
}

export default function Courses({ sections, assessments }: { sections: Section[]; assessments: Assessment[] }) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');

    const filteredSections = useMemo(() => {
        const query = search.trim().toLowerCase();
        return sections.filter((section) => {
            const matchesSection = !sectionFilter || section.id === sectionFilter;
            const matchesSearch = !query
                || section.name.toLowerCase().includes(query)
                || section.course?.name?.toLowerCase().includes(query)
                || section.teachers?.some((teacher) => teacher.user?.name?.toLowerCase().includes(query));

            return matchesSection && matchesSearch;
        });
    }, [search, sectionFilter, sections]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-black text-foreground">Enrolled Sections</h2>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {sections.length} active {sections.length === 1 ? 'section' : 'sections'}
                    </p>
                </div>
                <div className="w-full sm:w-80">
                    <SearchBar
                        placeholder="Search courses or teachers..."
                        value={search}
                        onChange={setSearch}
                    />
                </div>
            </div>

            {sections.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button
                        type="button"
                        onClick={() => setSectionFilter('')}
                        className={`min-h-9 shrink-0 rounded-md border px-3 text-xs font-black transition-colors ${sectionFilter === '' ? 'border-foreground/20 bg-foreground text-background' : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
                    >
                        All sections
                    </button>
                    {sections.map((section) => {
                        const sectionColor = getSectionColor(section.color);
                        const isActive = sectionFilter === section.id;
                        return (
                            <button
                                key={section.id}
                                type="button"
                                onClick={() => setSectionFilter(section.id)}
                                className="min-h-9 max-w-56 shrink-0 truncate rounded-md border px-3 text-xs font-black transition-transform hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                style={{
                                    ...(isActive ? getSectionSurfaceStyle(section, '24', 'CC') : {}),
                                    borderColor: isActive ? `${sectionColor}CC` : undefined,
                                    backgroundColor: isActive ? `${sectionColor}24` : 'transparent',
                                    color: sectionColor,
                                }}
                            >
                                {section.course?.name || 'Course'} - {section.name}
                            </button>
                        );
                    })}
                </div>
            )}

            {filteredSections.length === 0 ? (
                <EmptyState
                    icon={Book}
                    title={sections.length === 0 ? 'No active courses' : 'No courses found'}
                    description={sections.length === 0 ? 'Your active enrollments will appear here.' : 'Try another course, section, or teacher name.'}
                    className="min-h-80"
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {filteredSections.map((section) => {
                        const sectionColor = getSectionColor(section.color);
                        const teacherName = section.teachers?.[0]?.user?.name || 'Teacher not assigned';
                        const sectionAssessments = assessments.filter((assessment) => assessment.sectionId === section.id);
                        const completedAssessments = sectionAssessments.filter(isCompletedAssessment).length;
                        const progress = sectionAssessments.length > 0
                            ? Math.round((completedAssessments / sectionAssessments.length) * 100)
                            : null;
                        return (
                            <Card
                                key={section.id}
                                padding="md"
                                className="min-h-64 border shadow-sm"
                                style={{
                                    ...getSectionSurfaceStyle(section, '10', '55'),
                                    color: sectionColor,
                                    boxShadow: `inset 3px 0 0 ${sectionColor}`,
                                }}
                            >
                                <CardHeader>
                                    <div className="min-w-0">
                                        <CourseSectionLabel
                                            section={section}
                                            variant="stacked"
                                            as="h3"
                                            className="text-lg font-black leading-tight"
                                        />
                                    </div>
                                    <div
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"
                                        style={getSectionTintStyle(section)}
                                    >
                                        <Book className="h-5 w-5" />
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border p-3" style={getSectionSurfaceStyle(section, '0C', '38')}>
                                        <User className="h-4 w-4 shrink-0" style={{ color: sectionColor }} />
                                        <span className="truncate text-sm font-semibold" style={{ color: sectionColor }}>{teacherName}</span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border p-3" style={getSectionSurfaceStyle(section, '0C', '38')}>
                                        <MapPinHouse className="h-4 w-4 shrink-0" style={{ color: sectionColor }} />
                                        <span className="truncate text-sm font-semibold" style={{ color: sectionColor }}>{section.room || 'Room not specified'}</span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border p-3" style={getSectionSurfaceStyle(section, '0C', '38')}>
                                        <CalendarDays className="h-4 w-4 shrink-0" style={{ color: sectionColor }} />
                                        <span className="truncate text-sm font-semibold" style={{ color: sectionColor }}>{formatSectionSchedule(section)}</span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border p-3" style={getSectionSurfaceStyle(section, '0C', '38')}>
                                        <FileText className="h-4 w-4 shrink-0" style={{ color: sectionColor }} />
                                        <span className="truncate text-sm font-semibold" style={{ color: sectionColor }}>
                                            {section.courseMaterialsCount || 0} {(section.courseMaterialsCount || 0) === 1 ? 'material' : 'materials'}
                                        </span>
                                    </div>
                                    <div className="rounded-md border p-3" style={getSectionSurfaceStyle(section, '0C', '38')}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <CheckCircle className="h-4 w-4 shrink-0" style={{ color: sectionColor }} />
                                                <span className="truncate text-sm font-semibold" style={{ color: sectionColor }}>Assigned work</span>
                                            </div>
                                            <span className="shrink-0 text-xs font-black" style={{ color: sectionColor }}>
                                                {sectionAssessments.length > 0 ? `${completedAssessments}/${sectionAssessments.length}` : 'None'}
                                            </span>
                                        </div>
                                        {progress !== null && (
                                            <div className="mt-3 h-2 overflow-hidden rounded-full border" style={getSectionSurfaceStyle(section, '08', '38')}>
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${progress}%`, backgroundColor: sectionColor }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </CardContent>

                                <CardFooter style={{ borderColor: `${sectionColor}38` }} className="pt-4">
                                    <Button
                                        onClick={() => router.push(`/course-materials/${section.id}`)}
                                        variant="outline"
                                        icon={FileText}
                                        className="w-full"
                                        style={getSectionTintStyle(section)}
                                    >
                                        View Materials
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
