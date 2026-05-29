'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { AcademicCycle, Student, Transcript, Role } from '@/types';
import useSWR from 'swr';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { GraduationCap, Printer, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { BrandIcon } from '@/components/ui/Brand';
import { PageHeader } from '@/components/ui/PageShell';

export default function TranscriptsPage() {
    const { token, user } = useAuth();

    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [selectedCycleId, setSelectedCycleId] = useState<string>('');

    // Pre-select student if the user is a student themselves
    useEffect(() => {
        if (user?.role === Role.STUDENT && !selectedStudentId) {
            // Find student profile to get the actual studentId.
            // Ideally auth response has it, but let's just trigger a search.
            api.org.getStudentByUserId(user.id, token!).then(res => {
                if (res?.id) setSelectedStudentId(res.id);
            }).catch(console.error);
        }
    }, [user, token, selectedStudentId]);

    const cyclesKey = token ? ['academicCycles', { limit: 100 }] as const : null;
    const { data: cyclesData } = useSWR<{ data: AcademicCycle[] }>(cyclesKey);

    const [searchTerm, setSearchTerm] = useState('');
    const studentsKey = token && searchTerm.length >= 2 && user?.role !== Role.STUDENT ? ['studentsSearch', searchTerm] as const : null;
    const { data: studentsData } = useSWR<{ data: Student[] }>(studentsKey, async () => {
        return api.org.getStudents(token!, { search: searchTerm, limit: 10 });
    });

    const transcriptKey = (token && selectedStudentId) ? ['transcript', selectedStudentId, selectedCycleId] as const : null;
    const { data: transcript, isLoading, error } = useSWR<Transcript>(transcriptKey, async () => {
        return api.transcripts.getStudentTranscript(selectedStudentId, token!, selectedCycleId || undefined);
    });

    const handlePrint = () => {
        window.print();
    };

    if (!token) return <Loading className="h-full" text="Authenticating..." />;

    return (
        <div className="flex flex-col h-full w-full space-y-4">
            <PageHeader
                title="Academic Transcripts"
                description="View and generate student academic reports."
                icon={GraduationCap}
                actions={(
                    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end md:w-auto md:items-center">
                        {user?.role !== Role.STUDENT && (
                            <div className="w-full sm:w-72">
                                <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                                    Find Student
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search by name or reg #..."
                                        className="w-full bg-input border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {studentsData?.data && studentsData.data.length > 0 && searchTerm && (
                                        <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-xl shadow-2xl max-h-64 overflow-y-auto backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
                                            {studentsData.data.map(s => (
                                                <button
                                                    key={s.id}
                                                    className="w-full text-left px-4 py-3 text-sm hover:bg-primary/10 transition-colors flex items-center gap-3 border-b border-border last:border-0"
                                                    onClick={() => {
                                                        setSelectedStudentId(s.id);
                                                        setSearchTerm('');
                                                    }}
                                                >
                                                    <BrandIcon variant="user" size="sm" user={s.user} />
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold">{s.user?.name}</span>
                                                        <span className="text-xs text-muted-foreground">{s.registrationNumber || s.rollNumber}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="w-full sm:w-64">
                            <label className="text-xs font-bold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                                Academic Cycle
                            </label>
                            <CustomSelect
                                value={selectedCycleId}
                                onChange={(val) => setSelectedCycleId(val)}
                                options={[
                                    { value: '', label: 'All Cycles (Cumulative)' },
                                    ...(cyclesData?.data?.map(cycle => ({ value: cycle.id, label: cycle.name })) || [])
                                ]}
                                placeholder="Select Cycle"
                            />
                        </div>

                        <Button
                            onClick={handlePrint}
                            icon={Printer}
                            disabled={!transcript}
                            className="w-full sm:w-auto mt-0 sm:mt-5 h-10.5 shadow-lg shadow-primary/20"
                        >
                            Print
                        </Button>
                    </div>
                )}
            />

            <div className="flex-1 bg-card rounded-lg shadow-xl border border-border p-8 overflow-y-auto min-h-0 print:border-none print:shadow-none print:p-0 print:overflow-visible">
                {isLoading && <Loading text="Generating Transcript..." />}
                {error && <ErrorState error={error} onRetry={() => { }} />}

                {!isLoading && !error && !transcript && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20 print:hidden">
                        <GraduationCap className="w-16 h-16 opacity-20 mb-4" />
                        <p>Select a student and an academic cycle to view the transcript.</p>
                    </div>
                )}

                {transcript && (
                    <div className="space-y-8">
                        {/* Header */}
                        <div className="text-center border-b border-border/50 pb-6">
                            <h2 className="text-3xl font-serif font-bold text-foreground mb-2">OFFICIAL ACADEMIC TRANSCRIPT</h2>
                            <p className="text-muted-foreground">{transcript.academicCycleName || 'Cumulative Record'}</p>
                        </div>

                        {/* Student Details */}
                        <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg">
                            <div>
                                <p className="text-xs uppercase text-muted-foreground font-semibold">Student Name</p>
                                <p className="text-lg font-bold">{transcript.studentName}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-muted-foreground font-semibold">Cohort</p>
                                <p className="text-lg font-bold">{transcript.cohortName || 'Independent'}</p>
                            </div>
                        </div>

                        {/* Grades Table */}
                        <table className="w-full text-left text-sm">
                            <thead className="bg-primary/5 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                                <tr>
                                    <th className="py-3 px-4">Course Section</th>
                                    <th className="py-3 px-4">Source</th>
                                    <th className="py-3 px-4 text-center">Marks</th>
                                    <th className="py-3 px-4 text-center">Percentage</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                                {transcript.sections.map(section => (
                                    <tr key={section.sectionId} className={`${section.wasExcluded ? 'opacity-50 line-through' : ''}`}>
                                        <td className="py-4 px-4">
                                            <div className="font-semibold text-foreground">{section.courseName}</div>
                                            <div className="text-xs text-muted-foreground">{section.sectionName}</div>
                                        </td>
                                        <td className="py-4 px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                            {section.source}
                                        </td>
                                        <td className="py-4 px-4 text-center font-medium">
                                            {section.marksObtained} / {section.totalMarks}
                                        </td>
                                        <td className="py-4 px-4 text-center font-bold">
                                            {section.percentage}%
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${section.status === 'PASS' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                                {section.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {transcript.sections.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-muted-foreground italic">No academic records found for this period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Summary Footer */}
                        <div className="flex justify-end pt-6 border-t border-border/50">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Sections:</span>
                                    <span className="font-bold">{transcript.sections.length}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                                    <span className="font-semibold text-foreground uppercase tracking-wider text-sm">Overall Average:</span>
                                    <span className="text-2xl font-bold text-primary">{transcript.overallPercentage}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
