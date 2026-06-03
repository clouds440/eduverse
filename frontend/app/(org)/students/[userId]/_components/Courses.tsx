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
import { getSectionColor } from '@/lib/utils';

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

    const filteredSections = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return sections;
        return sections.filter((section) => (
            section.name.toLowerCase().includes(query)
            || section.course?.name?.toLowerCase().includes(query)
            || section.teachers?.some((teacher) => teacher.user?.name?.toLowerCase().includes(query))
        ));
    }, [search, sections]);

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
                                className="min-h-64"
                                style={{ boxShadow: `inset 3px 0 0 ${sectionColor}` }}
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
                                        style={{ borderColor: `${sectionColor}40`, backgroundColor: `${sectionColor}14`, color: sectionColor }}
                                    >
                                        <Book className="h-5 w-5" />
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-3">
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
                                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate text-sm font-semibold text-foreground">{teacherName}</span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
                                        <MapPinHouse className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate text-sm font-semibold text-foreground">{section.room || 'Room not specified'}</span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
                                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate text-sm font-semibold text-foreground">{formatSectionSchedule(section)}</span>
                                    </div>
                                    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
                                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {section.courseMaterialsCount || 0} {(section.courseMaterialsCount || 0) === 1 ? 'material' : 'materials'}
                                        </span>
                                    </div>
                                    <div className="rounded-md border border-border/60 bg-muted/25 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <CheckCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <span className="truncate text-sm font-semibold text-foreground">Assigned work</span>
                                            </div>
                                            <span className="shrink-0 text-xs font-black text-muted-foreground">
                                                {sectionAssessments.length > 0 ? `${completedAssessments}/${sectionAssessments.length}` : 'None'}
                                            </span>
                                        </div>
                                        {progress !== null && (
                                            <div className="mt-3 h-2 overflow-hidden rounded-full border border-border bg-background">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${progress}%`, backgroundColor: sectionColor }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </CardContent>

                                <CardFooter>
                                    <Button
                                        onClick={() => router.push(`/course-materials/${section.id}`)}
                                        variant="primary"
                                        icon={FileText}
                                        className="w-full"
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
