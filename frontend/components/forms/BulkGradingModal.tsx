'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Assessment, Section, Grade, GradeStatus, UpdateGradeRequest } from '@/types';
import { useGlobal } from '@/context/GlobalContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { BrandIcon } from '@/components/ui/Brand';
import { DocsLink } from '@/components/ui/DocsLink';
import { MIN_GRADE_MARKS, isAllowedGradeMarks, roundGradeMarks } from '@/lib/schemas';

interface BulkGradingModalProps {
    isOpen: boolean;
    onClose: () => void;
    assessment: Assessment;
    section: Section;
    existingGrades: Grade[];
    onSuccess: () => void;
}

export function BulkGradingModal({ isOpen, onClose, assessment, section, existingGrades, onSuccess }: BulkGradingModalProps) {
    const { token } = useAuth();
    const { dispatch } = useGlobal();

    // State to hold bulk marks and status
    const [bulkData, setBulkData] = useState<Record<string, { marksObtained: string, status: GradeStatus }>>({});
    const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
    const [globalStatus, setGlobalStatus] = useState<GradeStatus | ''>('');

    // Initialize bulk data using existing grades or defaults
    useEffect(() => {
        if (isOpen && section.students) {
            const initialData: Record<string, { marksObtained: string, status: GradeStatus }> = {};
            section.students.forEach((student) => {
                const grade = existingGrades.find(g => g.studentId === student.id);
                initialData[student.id] = {
                    marksObtained: grade ? grade.marksObtained.toString() : '',
                    status: grade ? grade.status : GradeStatus.DRAFT
                };
            });
            setBulkData(initialData);
            setBulkErrors({});
        }
    }, [isOpen, section.students, existingGrades]);

    const handleBulkSubmit = async () => {
        if (!token) return;
        dispatch({ type: 'UI_START_PROCESSING', payload: 'bulk-grading-submit' });
        try {
            const promises: Promise<Grade>[] = [];

            for (const [studentId, data] of Object.entries(bulkData)) {
                if (data.marksObtained.trim() !== '') {
                    const rawMarks = Number(data.marksObtained);
                    const marks = roundGradeMarks(rawMarks);
                    if (!Number.isFinite(rawMarks)) {
                        setBulkErrors({ [studentId]: 'Enter a valid number' });
                        dispatch({ type: 'UI_STOP_PROCESSING', payload: 'bulk-grading-submit' });
                        return; // Abort saving if validation fails
                    }
                    if (!isAllowedGradeMarks(marks)) {
                        setBulkErrors({ [studentId]: `Use 0 or at least ${MIN_GRADE_MARKS}` });
                        dispatch({ type: 'UI_STOP_PROCESSING', payload: 'bulk-grading-submit' });
                        return; // Abort saving if validation fails
                    }
                    if (marks > assessment.totalMarks) {
                        setBulkErrors({ [studentId]: `Cannot exceed ${assessment.totalMarks}` });
                        dispatch({ type: 'UI_STOP_PROCESSING', payload: 'bulk-grading-submit' });
                        return; // Abort saving if validation fails
                    }
                    const payload: UpdateGradeRequest = {
                        marksObtained: marks,
                        status: data.status,
                    };
                    promises.push(api.org.updateGrade(assessment.id, studentId, payload, token));
                }
            }

            if (promises.length > 0) {
                await Promise.all(promises);
                dispatch({ type: 'TOAST_ADD', payload: { message: 'All grades updated successfully!', type: 'success' } });
                onSuccess();
            } else {
                dispatch({ type: 'TOAST_ADD', payload: { message: 'No grades to update.', type: 'info' } });
            }
            onClose();
        } catch (error: unknown) {
            console.error('Failed to update bulk grades', error);
            const message = error instanceof Error ? error.message : 'Failed to update grades in bulk';
            dispatch({ type: 'TOAST_ADD', payload: { message: Array.isArray(message) ? message[0] : message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'bulk-grading-submit' });
        }
    };

    const handleInputChange = (studentId: string, field: 'marksObtained' | 'status', value: string) => {
        if (field === 'marksObtained') {
            setBulkErrors(prev => {
                if (!prev[studentId]) return prev;
                const next = { ...prev };
                delete next[studentId];
                return next;
            });
        }
        setBulkData(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value
            }
        }));
    };

    const handleGlobalStatusChange = (newStatus: GradeStatus) => {
        setGlobalStatus(newStatus);
        setBulkData(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(studentId => {
                next[studentId].status = newStatus;
            });
            return next;
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Grade All Students"
            subtitle={`Assessment: ${assessment.title}`}
            maxWidth="max-w-5xl"
        >
            <div className="space-y-6 md:space-y-8">
                {/* Instructions Section */}
                <div className="bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 md:p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-transparent opacity-50" />
                    <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-primary font-semibold text-sm md:text-base">Enter marks and status for each student. Blank marks will be skipped.</span>
                            <span className="text-muted-foreground mt-1 text-xs md:text-sm">
                                Total Marks: {assessment.totalMarks}. Only Finalized grades appear in transcripts. <DocsLink href="/docs/gradebook#bulk-grading">Bulk grading guide</DocsLink>
                            </span>
                        </div>
                        <div className="flex items-center gap-3 bg-card/80 backdrop-blur-sm p-2 md:p-3 rounded-xl border border-border/50 shadow-lg w-full md:w-auto">
                            <span className="text-xs tracking-wider text-muted-foreground whitespace-nowrap font-semibold">Apply to all:</span>
                            <div className="w-36 md:w-40">
                                <CustomSelect<GradeStatus>
                                    value={(globalStatus as GradeStatus) || GradeStatus.DRAFT}
                                    onChange={handleGlobalStatusChange}
                                    options={[
                                        { value: GradeStatus.DRAFT, label: 'Draft' },
                                        { value: GradeStatus.PUBLISHED, label: 'Published' },
                                        { value: GradeStatus.FINALIZED, label: 'Finalized' }
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Students Table */}
                <div className="overflow-x-auto max-h-[50vh] rounded-xl border border-border/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 shadow-sm">
                            <tr className="bg-muted/30 border-y border-border/50">
                                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-black tracking-wider text-muted-foreground">Student Name</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-black tracking-wider text-muted-foreground">Reg #</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-black tracking-wider text-muted-foreground">Marks Obtained</th>
                                <th className="px-4 md:px-6 py-3 md:py-4 text-xs font-black tracking-wider text-muted-foreground">Grade Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {section.students?.map((student) => (
                                <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 md:px-6 py-3 md:py-4">
                                        <div className="flex items-center gap-3">
                                            <BrandIcon variant="user" size="sm" user={student.user} className="w-9 h-9 md:w-10 md:h-10 shadow-md rounded-full" />
                                            <span className="font-semibold text-sm md:text-base text-foreground truncate max-w-37.5">{student.user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs md:text-sm text-muted-foreground">{student.registrationNumber || 'N/A'}</td>
                                    <td className="px-4 md:px-6 py-3 md:py-4">
                                        <input
                                            type="number"
                                            min={0}
                                            step="0.1"
                                            max={assessment.totalMarks}
                                            value={bulkData[student.id]?.marksObtained || ''}
                                            onChange={(e) => handleInputChange(student.id, 'marksObtained', e.target.value)}
                                            aria-invalid={bulkErrors[student.id] ? true : undefined}
                                            className={`w-24 md:w-28 bg-card/80 backdrop-blur-sm border rounded-lg px-3 py-2 text-sm md:text-base font-semibold focus:ring-2 outline-none transition-all ${bulkErrors[student.id] ? 'border-danger/70 bg-danger/5 focus:border-danger focus:ring-danger/20' : 'border-border focus:border-primary focus:ring-primary/20'}`}
                                            placeholder={`/${assessment.totalMarks}`}
                                        />
                                        {bulkErrors[student.id] && <p className="mt-1 text-xs text-danger font-semibold">{bulkErrors[student.id]}</p>}
                                    </td>
                                    <td className="px-4 md:px-6 py-3 md:py-4 min-w-36 md:min-w-40">
                                        <CustomSelect<GradeStatus>
                                            value={bulkData[student.id]?.status || GradeStatus.DRAFT}
                                            onChange={(val) => handleInputChange(student.id, 'status', val)}
                                            options={[
                                                { value: GradeStatus.DRAFT, label: 'Draft' },
                                                { value: GradeStatus.PUBLISHED, label: 'Published' },
                                                { value: GradeStatus.FINALIZED, label: 'Finalized' }
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-6 border-t border-border/50">
                    <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto h-12 font-semibold">
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleBulkSubmit} loadingId="bulk-grading-submit" loadingText="Saving All..." className="w-full sm:w-auto h-12 font-semibold min-w-36">
                        Save All Grades
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
