import { CourseResultComponentType } from '@/types';

export const sectionComponentTypeOptions: Array<{ value: CourseResultComponentType; label: string }> = [
    { value: 'OTHER', label: 'Other' },
    { value: 'THEORY', label: 'Theory' },
    { value: 'LAB', label: 'Lab' },
    { value: 'PRACTICAL', label: 'Practical' },
    { value: 'TUTORIAL', label: 'Tutorial' },
    { value: 'RECITATION', label: 'Recitation' },
    { value: 'CLINIC', label: 'Clinic' },
    { value: 'STUDIO', label: 'Studio' },
    { value: 'FIELDWORK', label: 'Fieldwork' },
];

export function formatComponentTypeLabel(componentType: CourseResultComponentType | string) {
    return componentType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatSectionWithComponentType(section: { code?: string | null; name?: string | null; componentType?: string | null }) {
    const sectionLabel = `${section.code || ''}${section.code && section.name ? ' - ' : ''}${section.name || 'Unnamed section'}`;
    return `${sectionLabel}${section.componentType ? ` (${formatComponentTypeLabel(section.componentType)})` : ''}`;
}
