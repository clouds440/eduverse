'use client';

import { useSearchParams } from 'next/navigation';
import { SectionRelationshipManager } from '@/components/sections/SectionRelationshipManager';

export default function SectionRelationshipsPage() {
    const searchParams = useSearchParams();
    return (
        <SectionRelationshipManager
            initialCourseId={searchParams.get('courseId') || undefined}
            initialAcademicCycleId={searchParams.get('academicCycleId') || undefined}
            initialSectionId={searchParams.get('sectionId') || undefined}
        />
    );
}
