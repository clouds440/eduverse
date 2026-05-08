'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { User, MapPinHouse, Book, LayoutDashboard, FileText } from 'lucide-react';
import { Section } from '@/types';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { SearchBar } from '@/components/ui/SearchBar';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function Courses({ sections }: { sections: Section[] }) {
    const router = useRouter();
    const { token } = useAuth();
    const [search, setSearch] = useState('');
    const [materialsCount, setMaterialsCount] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!token) return;

        const fetchMaterialsCount = async () => {
            const counts: Record<string, number> = {};
            await Promise.all(
                sections.map(async (section) => {
                    try {
                        const materials = await api.courseMaterials.getMaterials(section.id, token);
                        counts[section.id] = materials.length;
                    } catch (error) {
                        counts[section.id] = 0;
                        console.error('No materials found: ', error);
                    }
                })
            );
            setMaterialsCount(counts);
        };

        fetchMaterialsCount();
    }, [sections, token]);

    const filteredSections = sections.filter(sec =>
        sec.name.toLowerCase().includes(search.toLowerCase()) ||
        sec.course?.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-16 px-4 sm:px-6">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tighter leading-none">My Courses</h1>
                    <p className="text-muted-foreground mt-3 font-bold max-w-md tracking-tight">Access your classroom materials and track syllabus progress.</p>
                </div>
                <div className="w-full md:w-80">
                    <SearchBar
                        placeholder="Search your courses..."
                        value={search}
                        onChange={setSearch}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredSections.map((sec, index) => (
                    <Card
                        key={sec.id}
                        accentColor="bg-primary"
                        padding="lg"
                        delay={index * 100}
                    >
                        <CardHeader>
                            <div className="text-left">
                                <p className="text-[10px] font-black text-muted-foreground/60 tracking-[0.2em] mb-2">{sec.course?.name}</p>
                                <h3 className="text-2xl font-black text-foreground group-hover:text-primary transition-colors tracking-tight leading-tight">{sec.name}</h3>
                            </div>
                            <div className="p-3 bg-primary/5 rounded-2xl border border-primary/20 shadow-sm">
                                <Book className="w-6 h-6 text-primary" />
                            </div>
                        </CardHeader>

                        <CardContent>
                            <div className="space-y-4 mb-4 flex-1">
                                <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-bold tracking-widest">
                                    <div className="w-10 h-10 rounded-2xl bg-muted/30 flex items-center justify-center border border-border shadow-xs">
                                        <User className="w-5 h-5 text-muted-foreground/60" />
                                    </div>
                                    <span className="text-left">{sec.teachers?.[0]?.user?.name || 'Assigned Professor'}</span>
                                </div>
                                <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-bold tracking-widest">
                                    <div className="w-10 h-10 rounded-2xl bg-muted/30 flex items-center justify-center border border-border shadow-xs">
                                        <MapPinHouse className="w-5 h-5 text-muted-foreground/60" />
                                    </div>
                                    <span className="text-left">{sec.room || 'Room not specified'}</span>
                                </div>
                                <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-bold tracking-widest">
                                    <div className="w-10 h-10 rounded-2xl bg-muted/30 flex items-center justify-center border border-border shadow-xs">
                                        <FileText className="w-5 h-5 text-muted-foreground/60" />
                                    </div>
                                    <span className="text-left">{materialsCount[sec.id] || 0} Course Materials</span>
                                </div>
                            </div>

                            <div className="space-y-3 mt-8">
                                <div className="flex justify-between text-[10px] font-black text-muted-foreground/60 tracking-[0.15em]">
                                    <span>Syllabus Completion</span>
                                    <span className="text-foreground px-2 py-0.5 bg-muted rounded">75%</span>
                                </div>
                                <div className="w-full bg-muted h-3 rounded-full overflow-hidden shadow-inner p-0.5 border border-border">
                                    <div
                                        className="bg-primary h-full transition-all duration-1000 ease-out rounded-full shadow-lg"
                                        style={{ width: '75%' }}
                                    ></div>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="pt-8">
                            <Button
                                onClick={() => router.push(`/course-materials/${sec.id}`)}
                                variant="primary"
                                icon={LayoutDashboard}
                                className='w-full'
                            >
                                View Materials
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
                {filteredSections.length === 0 && (
                    <div className="col-span-full text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
                        <Book className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground font-bold tracking-widest text-xs italic">No courses found matching your search</p>
                    </div>
                )}
            </div>
        </div>
    );
}
