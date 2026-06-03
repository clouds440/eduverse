'use client';

import { useAuth } from '@/context/AuthContext';
import { FileText } from 'lucide-react';
import useSWR from 'swr';
import { Section, Role } from '@/types';
import { useParams } from 'next/navigation';
import CourseMaterials from '@/components/sections/CourseMaterials';
import { Loading } from '@/components/ui/Loading';
import { NotFound } from '@/components/NotFound';
import { PageHeader } from '@/components/ui/PageShell';
import { CourseSectionLabel } from '@/components/sections/SectionLabel';

export default function CourseMaterialsPage() {
    const { token, user } = useAuth();
    const params = useParams();

    const sectionId = params.id as string;

    // SWR for section data
    const sectionKey = token && sectionId ? ['section-materials', sectionId] as const : null;
    const { data: section, isLoading, error } = useSWR<Section>(sectionKey);
    const sectionExists = error ? false : (section ? true : null);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12 h-[60vh]">
                <Loading size="lg" />
            </div>
        );
    }

    if (sectionExists === false) {
        return <NotFound page="Section" />;
    }

    if (!section) return null;

    // Check if teacher is assigned to this section
    const isTeacherAssigned = section.teachers?.some(t => t.userId === user?.id)

    return (
        <div className="flex flex-col w-full space-y-8">
            <PageHeader
                title={<CourseSectionLabel section={section} />}
                description={`Materials for ${section.course?.name || 'the assigned course'} in ${section.academicCycle?.name || 'the academic cycle'}.`}
                icon={FileText}
                meta={(
                    <span className="rounded-md border border-border/70 bg-muted/35 px-2 py-1 text-xs font-black text-muted-foreground">
                        {section.id.substring(0, 8)}
                    </span>
                )}
            />

            {/* Course Materials Panel */}
            <div className="bg-card text-card-text rounded-lg shadow-2xl border border-border overflow-hidden">
                <div className="p-8 border-b border-border bg-linear-to-r from-primary/10 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-primary/20 rounded-lg">
                            <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tighter leading-none">Course Materials</h2>
                            <p className="text-[10px] font-black text-card-text/40 tracking-widest mt-1">View and download learning resources</p>
                        </div>
                    </div>
                </div>
                <div className="p-8 md:p-10">
                    <CourseMaterials sectionId={sectionId} role={user?.role as Role} isTeacherAssigned={isTeacherAssigned} />
                </div>
            </div>
        </div>
    );
}
