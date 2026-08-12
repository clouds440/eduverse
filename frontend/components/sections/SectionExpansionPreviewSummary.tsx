'use client';

import { Badge } from '@/components/ui/Badge';
import { CohortSectionExpansionPreview, CourseResultSchemePreview } from '@/types';
import { formatSectionWithComponentType } from '@/lib/sectionRelationships';

interface SectionExpansionPreviewSummaryProps {
    preview: CourseResultSchemePreview | CohortSectionExpansionPreview | null;
    mode: 'relationship' | 'cohort-create' | 'cohort-assign';
}

function isCohortPreview(preview: SectionExpansionPreviewSummaryProps['preview']): preview is CohortSectionExpansionPreview {
    return Boolean(preview && 'expandedSectionCount' in preview);
}

export function SectionExpansionPreviewSummary({ preview, mode }: SectionExpansionPreviewSummaryProps) {
    const sectionCount = isCohortPreview(preview)
        ? mode === 'cohort-assign' ? preview.sectionsToAddCount : preview.expandedSectionCount
        : preview?.sectionCount ?? 0;
    const sectionLabel = mode === 'cohort-assign' ? 'sections to add' : 'sections';
    const enrollmentLabel = mode === 'relationship' ? 'enrollments to add' : 'enrollments to ensure';
    const sections = isCohortPreview(preview) ? preview.sections : [];
    const missingEnrollments = preview?.missingEnrollments ?? [];

    return (
        <span className="block space-y-3 text-sm">
            <span className="grid gap-2 sm:grid-cols-3">
                <Badge variant="neutral" size="sm">{sectionCount} {sectionLabel}</Badge>
                <Badge variant="neutral" size="sm">{preview?.studentCount ?? 0} students</Badge>
                <Badge variant={(preview?.missingEnrollmentCount ?? 0) > 0 ? 'warning' : 'success'} size="sm">
                    {preview?.missingEnrollmentCount ?? 0} {enrollmentLabel}
                </Badge>
            </span>
            {isCohortPreview(preview) && preview.addedRelatedSectionCount > 0 && (
                <span className="block text-xs font-bold text-warning">{preview.addedRelatedSectionCount} related sections will be added automatically.</span>
            )}
            {sections.length > 0 && (
                <span className="block max-h-48 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2 text-left">
                    {sections.slice(0, 30).map((section) => (
                        <span key={section.id} className="block py-1 text-xs font-semibold text-muted-foreground">
                            {formatSectionWithComponentType(section)}{section.alreadyAssigned ? ' already assigned' : ''}
                        </span>
                    ))}
                    {sections.length > 30 && <span className="block py-1 text-xs font-bold text-muted-foreground">+{sections.length - 30} more</span>}
                </span>
            )}
            {missingEnrollments.length > 0 && mode === 'relationship' && (
                <span className="block max-h-48 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2 text-left">
                    {missingEnrollments.slice(0, 30).map((item) => (
                        <span key={`${item.studentId}:${item.sectionId}`} className="block py-1 text-xs font-semibold text-muted-foreground">
                            {item.studentName} will be enrolled in {item.sectionCode} - {item.sectionName}
                        </span>
                    ))}
                    {missingEnrollments.length > 30 && <span className="block py-1 text-xs font-bold text-muted-foreground">+{missingEnrollments.length - 30} more</span>}
                </span>
            )}
        </span>
    );
}
