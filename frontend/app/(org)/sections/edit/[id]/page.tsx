'use client';

import { useParams } from 'next/navigation';
import { SectionFormPage } from '@/components/sections/SectionFormPage';

export default function EditSectionPage() {
    const { id } = useParams<{ id: string }>();
    return <SectionFormPage sectionId={id} />;
}
