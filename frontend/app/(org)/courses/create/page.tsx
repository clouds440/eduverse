'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Clock3, LibraryBig, FileText } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { DocsLink } from '@/components/ui/DocsLink';
import { Role } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { api } from '@/lib/api';
import { mutate } from 'swr';
import { PageHeader } from '@/components/ui/PageShell';

export default function CreateCoursePage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        creditHours: '3',
    });

    useEffect(() => {
        if (!token || !user) return;

        // Teachers should not be able to create courses
        if (user.role === Role.TEACHER) {
            router.replace('/courses');
            return;
        }
    }, [token, user, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'course-create' });

        try {
            await api.org.createCourse({
                name: formData.name,
                description: formData.description,
                creditHours: Number(formData.creditHours),
            }, token);
            // Invalidate courses cache using SWR mutate
            mutate((key) => Array.isArray(key) && key[0] === 'courses');
            window.dispatchEvent(new Event('stats-updated'));
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Course created successfully', type: 'success' } });
            router.push('/courses');
        } catch (error: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Failed to create course', type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'course-create' });
        }
    };

    return (
        <div className="flex flex-col w-full max-w-6xl py-10 mx-auto animate-in fade-in duration-700">
            <PageHeader
                title="Create New Course"
                description={<>Expand your institution&apos;s academic catalog. <DocsLink href="/docs/courses-sections#courses">Read course docs</DocsLink></>}
                icon={LibraryBig}
                className="mb-8"
            />

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Left Side: Info Card */}
                <div className="w-full lg:w-1/3 space-y-6">
                    <div className="bg-primary/5 backdrop-blur-xl rounded-2xl border border-primary/10 p-6 md:p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
                        <h3 className="text-lg font-black tracking-tight mb-4 relative z-10">Course Definition</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed relative z-10 mb-6">
                            Courses are the subjects your school offers. Credit hours can affect GPA and transcripts. <DocsLink href="/docs/courses-sections#courses">Learn more</DocsLink>
                        </p>
                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-success/10 rounded-lg"><FileText className="w-4 h-4 text-success" /></div>
                                <span className="text-xs font-bold">Searchable in Catalog</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-info/10 rounded-lg"><LibraryBig className="w-4 h-4 text-info" /></div>
                                <span className="text-xs font-bold">Reusable across Cycles</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form Card */}
                <div className="flex-1 w-full">
                    <div className="bg-card/40 backdrop-blur-2xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden relative">
                        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />

                        <form onSubmit={handleSubmit} className="relative p-6 md:p-10 space-y-8" noValidate>
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Basic Information</Label>
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Course Name <span className="text-primary">*</span></Label>
                                            <Input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                icon={LibraryBig}
                                                placeholder="e.g. Advanced Mathematics"
                                                className="h-12 md:h-14 font-medium"
                                            />
                                            <p className="text-xs font-semibold text-muted-foreground">
                                                Used in transcript credit totals and weighted GPA. <DocsLink href="/docs/transcripts#transcript-calculation">Read transcript docs</DocsLink>
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Credit Hours <span className="text-primary">*</span></Label>
                                            <Input
                                                type="number"
                                                name="creditHours"
                                                value={formData.creditHours}
                                                onChange={handleChange}
                                                required
                                                min={0.01}
                                                step="0.5"
                                                icon={Clock3}
                                                placeholder="3"
                                                className="h-12 md:h-14 font-medium"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Full Description</Label>
                                            <Textarea
                                                name="description"
                                                value={formData.description}
                                                onChange={handleChange}
                                                rows={6}
                                                icon={FileText}
                                                placeholder="Detailed overview of learning objectives, prerequisites, and subject matter..."
                                                className="min-h-32 md:min-h-40 font-medium py-4"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-end gap-4">
                                <Link href="/courses" className="w-full sm:w-auto">
                                    <Button type="button" variant="secondary" className="w-full sm:px-10 h-12 font-bold tracking-tight">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    loadingId="course-create"
                                    className="w-full sm:px-12 h-12 font-black tracking-tight shadow-lg shadow-primary/20"
                                >
                                    Establish Course
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
