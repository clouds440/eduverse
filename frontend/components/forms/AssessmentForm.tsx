'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { BookOpen, Calendar, BookType, FileText, Percent, UploadCloud, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Assessment, AssessmentType, CreateAssessmentRequest, UpdateAssessmentRequest } from '@/types';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ExternalLinkInput } from '@/components/ui/ExternalLinkInput';
import { DocsLink } from '@/components/ui/DocsLink';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assessmentSchema, AssessmentFormData } from '@/lib/schemas';
import { Toggle } from '@/components/ui/Toggle';
import { GENERIC_UPLOAD_ACCEPT } from '@/lib/uploadPolicy';

interface AssessmentFormProps {
    sectionId: string;
    courseId: string;
    assessmentId?: string;
    initialData?: Assessment;
    onSuccess?: (assessment: Assessment) => void;
    onCancel?: () => void;
}

export default function AssessmentForm({
    sectionId,
    courseId,
    assessmentId,
    initialData,
    onSuccess,
    onCancel
}: AssessmentFormProps) {
    const { token } = useAuth();
    const { state, dispatch } = useGlobal();
    const isProcessing = state.ui.processing['assessment-submit'];

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<AssessmentFormData>({
        resolver: zodResolver(assessmentSchema),
        defaultValues: initialData ? {
            title: initialData.title,
            type: initialData.type,
            totalMarks: initialData.totalMarks.toString(),
            weightage: initialData.weightage.toString(),
            dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
            allowSubmissions: initialData.allowSubmissions ?? true,
            externalLink: initialData.externalLink || '',
            isVideoLink: initialData.isVideoLink || false,
        } : {
            title: '',
            type: AssessmentType.ASSIGNMENT,
            totalMarks: '100',
            weightage: '10',
            dueDate: '',
            allowSubmissions: true,
            externalLink: '',
            isVideoLink: false,
        }
    });

    const formData = watch();

    const onSubmit = async (data: AssessmentFormData) => {
        dispatch({ type: 'UI_START_PROCESSING', payload: 'assessment-submit' });
        try {
            const payload: CreateAssessmentRequest = {
                ...data,
                sectionId,
                courseId,
                totalMarks: Number(data.totalMarks),
                weightage: Number(data.weightage),
                dueDate: data.dueDate || undefined,
                allowSubmissions: data.allowSubmissions,
                externalLink: data.externalLink || undefined,
                isVideoLink: data.isVideoLink,
            };

            let savedAssessment: Assessment;
            if (assessmentId) {
                savedAssessment = await api.org.updateAssessment(assessmentId, payload as UpdateAssessmentRequest, token!);
            } else {
                savedAssessment = await api.org.createAssessment(payload, token!);
            }

            if (selectedFile) {
                // Determine orgId from initialData or token/context (assuming teacher creates within their org context, 
                // the section belongs to org. But api.files expects orgId. We can get it from savedAssessment parsing).
                // Or simply pass savedAssessment.organizationId since it's returned by backend DTO.
                const orgId = savedAssessment.organizationId || (initialData?.organizationId as string);
                try {
                    await api.files.uploadFile(orgId, 'ASSESSMENT', savedAssessment.id, selectedFile, token!);
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : 'Assessment saved but file upload failed';
                    dispatch({ type: 'TOAST_ADD', payload: { message: String(message), type: 'error' } });
                }
            }

            window.dispatchEvent(new Event('stats-updated'));
            dispatch({ type: 'TOAST_ADD', payload: { message: `Assessment ${assessmentId ? 'updated' : 'created'} successfully.`, type: 'success' } });
            onSuccess?.(savedAssessment);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save assessment';
            dispatch({ type: 'TOAST_ADD', payload: { message: Array.isArray(message) ? message[0] : message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'assessment-submit' });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
            <p className="text-sm font-semibold text-muted-foreground">
                Assessments can collect submissions and later feed grading. <DocsLink href="/docs/assessments-grading#assessment-setup">Read assessment setup</DocsLink>
            </p>

            <div className="space-y-4 md:space-y-6">
                <div className="space-y-2 md:space-y-3">
                    <Label htmlFor="title">Assessment Title</Label>
                    <Input
                        id="title"
                        type="text"
                        {...register('title')}
                        error={!!errors.title}
                        icon={FileText}
                        placeholder="e.g. Midterm Exam, Assignment 1"
                        className="font-medium"
                    />
                    {errors.title && <p className="text-xs text-danger font-semibold">{errors.title.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2 md:space-y-3">
                        <Label>Assessment Type</Label>
                        <CustomSelect
                            options={[
                                { value: AssessmentType.ASSIGNMENT, label: 'Assignment' },
                                { value: AssessmentType.QUIZ, label: 'Quiz' },
                                { value: AssessmentType.MIDTERM, label: 'Midterm' },
                                { value: AssessmentType.FINAL, label: 'Final Exam' },
                                { value: AssessmentType.PROJECT, label: 'Project' },
                            ]}
                            value={formData.type}
                            onChange={(val) => setValue('type', val as AssessmentType)}
                            error={!!errors.type}
                            icon={BookType}
                        />
                        {errors.type && <p className="text-xs text-danger font-semibold">{errors.type.message}</p>}
                    </div>

                    <div className="space-y-2 md:space-y-3">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input
                            id="dueDate"
                            type="date"
                            {...register('dueDate')}
                            error={!!errors.dueDate}
                            icon={Calendar}
                            className="font-medium"
                        />
                        {errors.dueDate && <p className="text-xs text-danger font-semibold">{errors.dueDate.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2 md:space-y-3">
                        <Label htmlFor="totalMarks">Total Marks</Label>
                        <Input
                            id="totalMarks"
                            type="number"
                            {...register('totalMarks')}
                            error={!!errors.totalMarks}
                            icon={BookOpen}
                            placeholder="100"
                            className="font-medium"
                        />
                        {errors.totalMarks && <p className="text-xs text-danger font-semibold">{errors.totalMarks.message}</p>}
                    </div>

                    <div className="space-y-2 md:space-y-3">
                        <Label htmlFor="weightage">Weightage (%)</Label>
                        <Input
                            id="weightage"
                            type="number"
                            {...register('weightage')}
                            error={!!errors.weightage}
                            icon={Percent}
                            placeholder="10"
                            className="font-medium"
                        />
                        {errors.weightage && <p className="text-xs text-danger font-semibold">{errors.weightage.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2 md:space-y-3">
                        <ExternalLinkInput
                            value={watch('externalLink') || ''}
                            onChange={(value) => setValue('externalLink', value)}
                            isVideo={watch('isVideoLink') || false}
                            onIsVideoChange={(isVideo) => setValue('isVideoLink', isVideo)}
                            disabled={isProcessing}
                            error={errors.externalLink?.message}
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <Label>Attachment (Optional)</Label>
                            {selectedFile && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedFile(null);
                                        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                                        if (fileInput) fileInput.value = '';
                                    }}
                                    className="p-1 shrink-0 border border-danger/60 hover:border-danger hover:bg-danger/10 text-muted-foreground hover:text-danger rounded-lg transition-all shadow-sm"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="relative flex items-center gap-2">
                            <input
                                type="file"
                                id="file-upload"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setSelectedFile(e.target.files[0]);
                                    }
                                }}
                                accept={GENERIC_UPLOAD_ACCEPT}
                            />
                            <Label
                                htmlFor="file-upload"
                                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl cursor-pointer transition-all flex-1 ${selectedFile ? 'border-primary/50 bg-primary/5 text-primary shadow-sm' : 'border-border hover:border-primary/30 text-muted-foreground bg-card/50 hover:bg-card'}`}
                            >
                                <UploadCloud className="ml-3 w-4 h-4 text-primary" />
                                <span className="truncate py-0.5 rounded-xl text-sm font-semibold flex-1">
                                    {selectedFile ? selectedFile.name.length > 25 ? selectedFile.name.slice(0, 25) + '...' : selectedFile.name : 'Choose file...'}
                                </span>
                                {selectedFile && <Check className="w-4 h-4 text-success" />}
                            </Label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 md:p-5 bg-linear-to-br from-primary/5 via-primary/10 to-primary/5 border border-primary/20 rounded-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-transparent opacity-50" />
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full select-none">
                        <Toggle
                            checked={watch('allowSubmissions')}
                            onCheckedChange={(checked) => setValue('allowSubmissions', checked)}
                            label="Allow Submissions"
                            description={<>Enable students to upload work for this assessment. <DocsLink href="/docs/submissions#student-submissions">Submission guide</DocsLink></>}
                            textColor='text-muted-foreground'
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-6 border-t border-border/50">
                <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto h-12 font-semibold">
                    Cancel
                </Button>
                <Button type="submit" loadingId="assessment-submit" loadingText="Saving..." className="w-full sm:w-auto h-12 font-semibold">
                    {assessmentId ? 'Update Assessment' : 'Create Assessment'}
                </Button>
            </div>
        </form>
    );
}
