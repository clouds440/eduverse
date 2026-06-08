'use client';

import { useAuth } from '@/context/AuthContext';
import { Check, Edit3, MessageCircle, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Grade, GradeStatus, UpdateGradeRequest, Student } from '@/types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { gradeSchema, GradeFormData, MIN_GRADE_MARKS, isAllowedGradeMarks, roundGradeMarks } from '@/lib/schemas';
import { BrandIcon } from '../ui/Brand';

interface GradingFormProps {
    assessmentId: string;
    student: Student;
    initialData?: Grade;
    totalMarks: number;
    onSuccess?: (grade: Grade) => void;
    onCancel?: () => void;
}

export default function GradingForm({
    assessmentId,
    student,
    initialData,
    totalMarks,
    onSuccess,
    onCancel
}: GradingFormProps) {
    const { dispatch } = useGlobal();

    const { token } = useAuth();

    const {
        register,
        handleSubmit,
        setError,
        setValue,
        watch,
        formState: { errors },
    } = useForm<GradeFormData>({
        resolver: zodResolver(gradeSchema),
        defaultValues: initialData ? {
            marksObtained: initialData.marksObtained.toString(),
            feedback: initialData.feedback || '',
            status: initialData.status,
        } : {
            marksObtained: '',
            feedback: '',
            status: GradeStatus.DRAFT,
        }
    });

    const formData = watch();

    const onSubmit: SubmitHandler<GradeFormData> = async (data) => {
        const marksObtained = roundGradeMarks(Number(data.marksObtained));

        if (!isAllowedGradeMarks(marksObtained)) {
            setError('marksObtained', { type: 'min', message: `Use 0 or at least ${MIN_GRADE_MARKS}` });
            return;
        }

        if (marksObtained > totalMarks) {
            dispatch({ type: 'TOAST_ADD', payload: { message: `Marks obtained cannot exceed total marks (${totalMarks})`, type: 'error' } });
            return;
        }

        dispatch({ type: 'UI_START_PROCESSING', payload: 'grading-submit' });
        try {
            const payload: UpdateGradeRequest = {
                marksObtained,
                feedback: data.feedback || undefined,
                status: data.status,
            };

            const savedGrade = await api.org.updateGrade(assessmentId, student.id, payload, token!);
            dispatch({ type: 'TOAST_ADD', payload: { message: `Grade updated for ${student.user.name}.`, type: 'success' } });
            onSuccess?.(savedGrade);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save grade';
            dispatch({ type: 'TOAST_ADD', payload: { message: Array.isArray(message) ? message[0] : message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'grading-submit' });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-8" noValidate>
            {/* Student Info Card */}
            <div className="bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 md:p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-transparent opacity-50" />
                <div className="relative flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                        <div className="relative rounded-full">
                            <BrandIcon variant='user' user={student.user} size='xl' />
                        </div>
                    </div>
                    <div>
                        <h4 className="text-base md:text-lg font-black text-foreground">{student.user.name}</h4>
                        <p className="text-xs md:text-sm text-muted-foreground font-medium">{student.rollNumber || 'No Roll Number'}</p>
                    </div>
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2 md:space-y-3">
                        <Label htmlFor="marksObtained">Marks Obtained (out of {totalMarks})</Label>
                        <Input
                            id="marksObtained"
                            type="number"
                            min={0}
                            step="0.1"
                            {...register('marksObtained')}
                            error={!!errors.marksObtained}
                            icon={Star}
                            placeholder={`e.g. ${Math.round(totalMarks * 0.85)}`}
                            className="font-medium"
                        />
                        {errors.marksObtained && <p className="text-xs text-danger font-semibold">{errors.marksObtained.message}</p>}
                    </div>

                    <div className="space-y-2 md:space-y-3">
                        <Label>Grade Status</Label>
                        <CustomSelect
                            options={[
                                { value: GradeStatus.DRAFT, label: 'Draft' },
                                { value: GradeStatus.PUBLISHED, label: 'Published' },
                                { value: GradeStatus.FINALIZED, label: 'Finalized' },
                            ]}
                            value={formData.status || GradeStatus.DRAFT}
                            onChange={(val) => setValue('status', val as GradeStatus)}
                            error={!!errors.status}
                            icon={Edit3}
                        />
                        {errors.status && <p className="text-xs text-danger font-semibold">{errors.status.message}</p>}
                    </div>
                </div>

                <div className="space-y-2 md:space-y-3">
                    <Label htmlFor="feedback">Feedback (Optional)</Label>
                    <Textarea
                        id="feedback"
                        {...register('feedback')}
                        icon={MessageCircle}
                        placeholder="Great job! Keep it up."
                        className="min-h-30 font-medium"
                    />
                </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-6 border-t border-border/50">
                <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto h-12 font-semibold">
                    Cancel
                </Button>
                <Button
                    type="submit"
                    loadingId="grading-submit"
                    loadingText="Saving..."
                    icon={Check}
                >
                    Save Grade
                </Button>
            </div>
        </form>
    );
}
