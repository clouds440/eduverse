'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, MapPinHouse, Book, CalendarDays, FileText, CheckCircle } from 'lucide-react';
import { Assessment, GradeStatus, Section } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { FilterDrawerGrid, PageControls } from '@/components/ui/FilterDrawerToolbar';
import { usePageActionsHost } from '@/components/ui/PageActionsHost';
import type { ActiveFilter } from '@/components/ui/PageShell';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';
import { fuzzyFilterAndRank } from '@/lib/fuzzySearch';
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
        const scopedSections = sectionFilter
            ? sections.filter((section) => section.id === sectionFilter)
            : sections;
        return fuzzyFilterAndRank(scopedSections, search, (section) => [
            section.name,
            section.course?.name,
            section.course?.code,
            ...(section.teachers?.map((teacher) => teacher.user?.name || teacher.user?.email || teacher.subject) || []),
        ]);
    }, [search, sectionFilter, sections]);
    const selectedSection = sections.find((section) => section.id === sectionFilter);
    const activeFilters = useMemo<ActiveFilter[]>(() => (
        selectedSection ? [{
            key: 'section',
            label: 'Section',
            value: `${selectedSection.course?.name || 'Course'} - ${selectedSection.name}`,
            onRemove: () => setSectionFilter(''),
        }] : []
    ), [selectedSection]);

    const pageControls = useMemo(() => (
        <PageControls
            drawerLabel="Course filters"
            activeFilters={activeFilters}
            leading={<SearchBar placeholder="Search courses or teachers..." value={search} onChange={setSearch} mobileMode="expandable" />}
            renderFilters={() => (
                <FilterDrawerGrid>
                    <CustomSelect
                        value={sectionFilter}
                        onChange={setSectionFilter}
                        options={[
                            { value: '', label: 'All sections' },
                            ...sections.map((section) => ({
                                value: section.id,
                                label: `${section.course?.name || 'Course'} - ${section.name}`,
                            })),
                        ]}
                        placeholder="All sections"
                        searchable
                    />
                </FilterDrawerGrid>
            )}
        />
    ), [activeFilters, search, sectionFilter, sections]);
    const controlsHosted = usePageActionsHost(pageControls);

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                <div>
                    <h2 className="text-base font-black text-foreground">Enrolled Sections</h2>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                        {sections.length} active {sections.length === 1 ? 'section' : 'sections'}
                    </p>
                </div>
                {!controlsHosted && pageControls}
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
                                className="min-h-64 border shadow-sm hover:scale-101 transition-transform"
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
                                        className="w-full cursor-pointer hover:scale-101 transition-transform"
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
