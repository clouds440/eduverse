'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, Hash, AlertCircle, LibraryBig, Network, Layers } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { useGlobal } from '@/context/GlobalContext';
import Link from 'next/link';
import { ApiError, Course, Role, PaginatedResponse, AcademicCycle, Cohort, Room } from '@/types';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageShell';
import { DEFAULT_SECTION_COLOR, SECTION_COLOR_PALETTE, formatRoomLabel, isSectionPaletteColor } from '@/lib/utils';

export default function CreateSectionPage() {
    const { token, user } = useAuth();
    const { dispatch } = useGlobal();
    const router = useRouter();

    const [formData, setFormData] = useState({
        name: '',
        room: '',
        defaultRoomId: '',
        courseId: '',
        academicCycleId: '',
        cohortId: '',
        color: DEFAULT_SECTION_COLOR,
    });

    const canCreateSection = user?.role === Role.ORG_ADMIN || user?.role === Role.SUB_ADMIN;
    const canFetchCourses = token && canCreateSection;
    const coursesKey = canFetchCourses ? ['courses', { limit: 1000 }] as const : null;
    const { data: coursesData } = useSWR<PaginatedResponse<Course>>(coursesKey);
    const courses = coursesData?.data || [];

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    const cohortsKey = token ? ['cohorts', { limit: 500 }] as const : null;
    const { data: cohortsData } = useSWR<{ data: Cohort[] }>(cohortsKey);

    const roomsKey = token ? ['rooms', { limit: 1000, isActive: true }] as const : null;
    const { data: roomsData } = useSWR<PaginatedResponse<Room>>(roomsKey);

    useEffect(() => {
        if (!user) return;

        if (!canCreateSection) {
            router.replace('/sections');
        }
    }, [canCreateSection, user, router]);

    const [formErrors, setFormErrors] = useState<{ name?: string; academicCycleId?: string; courseId?: string; teacherId?: string; room?: string; color?: string; general?: string }>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormErrors({});

        let hasError = false;
        if (!formData.academicCycleId) {
            setFormErrors(prev => ({ ...prev, academicCycleId: 'Academic Cycle is required' }));
            hasError = true;
        }
        if (!formData.name) {
            setFormErrors(prev => ({ ...prev, name: 'Section Name is required' }));
            hasError = true;
        }
        if (!isSectionPaletteColor(formData.color)) {
            setFormErrors(prev => ({ ...prev, color: 'Choose one of the preset section colors' }));
            hasError = true;
        }

        if (hasError) return;

        dispatch({ type: 'UI_START_PROCESSING', payload: 'section-create' });

        try {
            if (!token) return;

            await api.org.createSection({
                ...formData,
                room: undefined,
                defaultRoomId: formData.defaultRoomId || null,
            }, token);
            mutate((key) => Array.isArray(key) && key[0] === 'sections');

            window.dispatchEvent(new Event('stats-updated'));
            dispatch({ type: 'TOAST_ADD', payload: { message: 'Section created successfully', type: 'success' } });
            router.push('/sections');
        } catch (error: unknown) {
            const apiError = error as ApiError;
            const message = apiError.response?.data?.message || apiError.message || 'Failed to create section';
            const newErrors: typeof formErrors = {};

            if (Array.isArray(message)) {
                message.forEach((m: string) => {
                    const msg = m.toLowerCase();
                    if (msg.includes('name')) newErrors.name = m;
                    else if (msg.includes('course')) newErrors.courseId = m;
                    else if (msg.includes('teacher')) newErrors.teacherId = m;
                    else if (msg.includes('color')) newErrors.color = m;
                    else if (msg.includes('cycle')) newErrors.academicCycleId = m;
                    else newErrors.general = m;
                });
            } else {
                const msgStr = message;
                if (msgStr.toLowerCase().includes('name')) newErrors.name = msgStr;
                else if (msgStr.toLowerCase().includes('course')) newErrors.courseId = msgStr;
                else if (msgStr.toLowerCase().includes('teacher')) newErrors.teacherId = msgStr;
                else if (msgStr.toLowerCase().includes('color')) newErrors.color = msgStr;
                else if (msgStr.toLowerCase().includes('cycle')) newErrors.academicCycleId = msgStr;
                else newErrors.general = msgStr;
            }
            setFormErrors(newErrors);
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'section-create' });
        }
    };

    return (
        <div className="flex flex-col w-full max-w-6xl py-10 mx-auto animate-in fade-in duration-700">
            <PageHeader
                title="Create New Section"
                description={<>Define a class offering for a course and cycle. <DocsLink href="/docs/courses-sections#section-creation">Read section docs</DocsLink></>}
                icon={Layers}
                className="mb-8"
            />

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Left Side: Info Card */}
                <div className="w-full lg:w-1/3 space-y-6">
                    <div className="bg-primary/5 backdrop-blur-xl rounded-2xl border border-primary/10 p-6 md:p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
                        <h3 className="text-lg font-black tracking-tight mb-4 relative z-10">Section Placement</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed relative z-10 mb-6">
                            Sections connect a course to students, teachers, schedules, attendance, and grades. <DocsLink href="/docs/courses-sections#section-records">Learn more</DocsLink>
                        </p>
                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-warning/10 rounded-lg"><Calendar className="w-4 h-4 text-warning" /></div>
                                <span className="text-xs font-bold">Cycle-specific enrollment</span>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                                <div className="p-2 bg-primary/10 rounded-lg"><MapPin className="w-4 h-4 text-primary" /></div>
                                <span className="text-xs font-bold">Resource Allocation</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border/50 rounded-2xl p-6 relative overflow-hidden shadow-xl shadow-primary/5">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="w-5 h-5 text-primary opacity-50" />
                            <h4 className="text-sm font-black tracking-tight uppercase">Requirements</h4>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Unique section name for the course</span>
                            </li>
                            <li className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                                <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                <span>Valid Academic Cycle association</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Right Side: Form Card */}
                <div className="flex-1 w-full">
                    <div className="bg-card/40 backdrop-blur-2xl rounded-2xl shadow-2xl border border-border/50 overflow-hidden relative">
                        <div className="absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-secondary/5 opacity-50" />

                        <form onSubmit={handleSubmit} className="relative p-6 md:p-10 space-y-8" noValidate>
                            <div className="space-y-8">
                                {/* Academic Context Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Academic Context</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Parent Course <span className="text-primary">*</span></Label>
                                            <CustomSelect
                                                value={formData.courseId}
                                                onChange={(value) => setFormData({ ...formData, courseId: value })}
                                                icon={LibraryBig}
                                                options={courses.map((c: Course) => ({ value: c.id, label: c.name }))}
                                                placeholder="Select course..."
                                                required
                                                searchable
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Academic Cycle <span className="text-primary">*</span></Label>
                                            <CustomSelect
                                                value={formData.academicCycleId}
                                                onChange={(value) => setFormData({ ...formData, academicCycleId: value, cohortId: '' })}
                                                icon={Calendar}
                                                options={[
                                                    ...(cyclesData?.data?.map((c: AcademicCycle) => ({ value: c.id, label: c.name })) || [])
                                                ]}
                                                placeholder="Select cycle..."
                                                required
                                                error={!!formErrors.academicCycleId}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section Details Section */}
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Section Identity</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Section Identifier <span className="text-primary">*</span></Label>
                                            <Input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                icon={Hash}
                                                placeholder="e.g. Morning - A"
                                                error={!!formErrors.name}
                                                className="h-12 md:h-14 font-medium"
                                            />
                                            {formErrors.name && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.name}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-bold ml-1">Default Room</Label>
                                            <CustomSelect
                                                value={formData.defaultRoomId}
                                                onChange={(value) => setFormData({ ...formData, defaultRoomId: value })}
                                                icon={MapPin}
                                                options={[
                                                    { value: '', label: 'No Default Room' },
                                                    ...(roomsData?.data?.map((room) => ({
                                                        value: room.id,
                                                        label: formatRoomLabel(room),
                                                    })) || []),
                                                ]}
                                                placeholder="Select room..."
                                                searchable
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm font-bold ml-1">Assigned Cohort (Optional)</Label>
                                        <CustomSelect
                                            value={formData.cohortId}
                                            onChange={(value) => setFormData({ ...formData, cohortId: value })}
                                            options={[
                                                { label: 'None (Individual Enrollment)', value: '' },
                                                ...(cohortsData?.data?.filter((c: Cohort) => !formData.academicCycleId || c.academicCycleId === formData.academicCycleId).map((c: Cohort) => ({
                                                    value: c.id,
                                                    label: c.name
                                                })) || [])
                                            ]}
                                            icon={Network}
                                            placeholder="Select student cohort..."
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-sm font-bold ml-1">Section Color</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {SECTION_COLOR_PALETTE.map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, color })}
                                                    className={`h-9 w-9 rounded-md border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${formData.color === color ? 'scale-110 border-foreground ring-2 ring-primary/30' : 'border-border/70'}`}
                                                    style={{ backgroundColor: color }}
                                                    aria-label={`Use section color ${color}`}
                                                    aria-pressed={formData.color === color}
                                                />
                                            ))}
                                        </div>
                                        {formErrors.color && <p className="mt-1 text-xs text-danger font-semibold ml-1">{formErrors.color}</p>}
                                    </div>
                                </div>
                            </div>

                            {formErrors.general && (
                                <div className="p-4 bg-danger/10 border border-danger/20 text-danger rounded-xl flex items-center text-sm font-bold animate-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
                                    {formErrors.general}
                                </div>
                            )}

                            <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-end gap-4">
                                <Link href="/sections" className="w-full sm:w-auto">
                                    <Button type="button" variant="secondary" className="w-full sm:px-10 h-12 font-bold tracking-tight">
                                        Cancel
                                    </Button>
                                </Link>
                                <Button
                                    type="submit"
                                    loadingId="section-create"
                                    className="w-full sm:px-12 h-12 font-black tracking-tight shadow-lg shadow-primary/20"
                                >
                                    Activate Section
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
