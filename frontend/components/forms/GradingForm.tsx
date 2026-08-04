'use client';

import { useAuth } from '@/context/AuthContext';
import { Check, Edit3, MessageCircle, Paperclip, Star, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useGlobal } from '@/context/GlobalContext';
import { Grade, GradeAnswerbookAttachment, GradeStatus, UpdateGradeRequest, Student } from '@/types';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocsLink } from '@/components/ui/DocsLink';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { gradeSchema, GradeFormData, MIN_GRADE_MARKS, isAllowedGradeMarks, roundGradeMarks } from '@/lib/schemas';
import { BrandIcon } from '../ui/Brand';
import { useEffect, useRef, useState } from 'react';
import { AttachmentPreviewCard, getAttachmentPreviewKind } from '../ui/AttachmentPreviewCard';
import { ANSWERBOOK_MAX_FILES, ANSWERBOOK_UPLOAD_ACCEPT, getAnswerbookUploadError } from '@/lib/uploadPolicy';
import { formatBytes, getPublicUrl } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<GradeAnswerbookAttachment[]>(initialData?.answerbookAttachments || []);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
    const [attachmentToDelete, setAttachmentToDelete] = useState<GradeAnswerbookAttachment | null>(null);

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
            correctionReason: '',
            answerbookReferenceNumber: initialData.answerbookReferenceNumber || '',
        } : {
            marksObtained: '',
            feedback: '',
            status: GradeStatus.DRAFT,
            correctionReason: '',
            answerbookReferenceNumber: '',
        }
    });

    const formData = watch();
    const isCorrectingFinalizedGrade = initialData?.status === GradeStatus.FINALIZED;

    useEffect(() => {
        setAttachments(initialData?.answerbookAttachments || []);
        if (!initialData?.id || !token) return;
        let active = true;
        api.org.getGradeAnswerbookAttachments(initialData.id, token)
            .then((items) => { if (active) setAttachments(items); })
            .catch(() => undefined);
        return () => { active = false; };
    }, [initialData?.id, initialData?.answerbookAttachments, token]);

    const handleFileSelection = (files: FileList | null) => {
        if (!files) return;
        const availableSlots = ANSWERBOOK_MAX_FILES - attachments.length - pendingFiles.length;
        const incoming = Array.from(files).slice(0, Math.max(availableSlots, 0));
        if (incoming.length < files.length) {
            dispatch({ type: 'TOAST_ADD', payload: { message: `A grade can have at most ${ANSWERBOOK_MAX_FILES} answerbook files.`, type: 'error' } });
        }
        const accepted: File[] = [];
        for (const file of incoming) {
            const error = getAnswerbookUploadError(file);
            if (error) {
                dispatch({ type: 'TOAST_ADD', payload: { message: `${file.name}: ${error}`, type: 'error' } });
                continue;
            }
            const duplicate = [...pendingFiles, ...accepted].some((item) => item.name === file.name && item.size === file.size);
            if (!duplicate) accepted.push(file);
        }
        setPendingFiles((current) => [...current, ...accepted]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = async (attachment: GradeAnswerbookAttachment) => {
        if (!initialData?.id || !token || isCorrectingFinalizedGrade) return;
        setDeletingAttachmentId(attachment.id);
        try {
            const result = await api.org.deleteGradeAnswerbookAttachment(initialData.id, attachment.id, token);
            setAttachments((current) => current.filter((item) => item.id !== attachment.id));
            dispatch({
                type: 'TOAST_ADD',
                payload: {
                    message: result.cleanupPending ? 'Attachment removed; storage cleanup will retry automatically.' : 'Answerbook attachment removed.',
                    type: result.cleanupPending ? 'info' : 'success',
                },
            });
        } catch (error: unknown) {
            dispatch({ type: 'TOAST_ADD', payload: { message: error instanceof Error ? error.message : 'Failed to remove attachment', type: 'error' } });
        } finally {
            setDeletingAttachmentId(null);
        }
    };

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
                correctionReason: isCorrectingFinalizedGrade ? data.correctionReason?.trim() : undefined,
                answerbookReferenceNumber: data.answerbookReferenceNumber?.trim() || null,
            };

            const savedGrade = await api.org.updateGrade(assessmentId, student.id, payload, token!);
            const uploaded: GradeAnswerbookAttachment[] = [];
            for (const file of pendingFiles) {
                const attachment = await api.org.uploadGradeAnswerbookAttachment(savedGrade.id, file, token!);
                uploaded.push(attachment);
                setAttachments((current) => [...current, attachment]);
                setPendingFiles((current) => current.filter((item) => item !== file));
            }
            const savedAttachments = savedGrade.answerbookAttachments || attachments;
            const completedGrade = { ...savedGrade, answerbookAttachments: [...savedAttachments, ...uploaded] };
            setPendingFiles([]);
            dispatch({ type: 'TOAST_ADD', payload: { message: `Grade updated for ${student.user.name}.`, type: 'success' } });
            onSuccess?.(completedGrade);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to save grade';
            dispatch({ type: 'TOAST_ADD', payload: { message: Array.isArray(message) ? message[0] : message, type: 'error' } });
        } finally {
            dispatch({ type: 'UI_STOP_PROCESSING', payload: 'grading-submit' });
        }
    };

    return (
        <>
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
                        {!errors.marksObtained && (
                            <p className="text-xs font-semibold text-muted-foreground">
                                Use 0, or at least {MIN_GRADE_MARKS}. <DocsLink href="/docs/assessments-grading#grade-input-rules">Rules</DocsLink>
                            </p>
                        )}
                    </div>

                    <div className="space-y-2 md:space-y-3">
                        <Label>Grade Status</Label>
                        <CustomSelect
                            options={[
                                { value: GradeStatus.DRAFT, label: 'Draft' },
                                { value: GradeStatus.PUBLISHED, label: 'Published' },
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

                <div className="space-y-3 border-t border-border/60 pt-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <div className="space-y-2">
                            <Label htmlFor="answerbookReferenceNumber">Answerbook Reference (Optional)</Label>
                            <Input
                                id="answerbookReferenceNumber"
                                {...register('answerbookReferenceNumber')}
                                error={!!errors.answerbookReferenceNumber}
                                icon={Paperclip}
                                maxLength={100}
                                placeholder="Reference or booklet number"
                            />
                            {errors.answerbookReferenceNumber && <p className="text-xs font-semibold text-danger">{errors.answerbookReferenceNumber.message}</p>}
                        </div>
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ANSWERBOOK_UPLOAD_ACCEPT}
                                multiple
                                className="hidden"
                                onChange={(event) => handleFileSelection(event.target.files)}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                icon={Upload}
                                disabled={isCorrectingFinalizedGrade || attachments.length + pendingFiles.length >= ANSWERBOOK_MAX_FILES}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                Add files
                            </Button>
                        </div>
                    </div>

                    {(attachments.length > 0 || pendingFiles.length > 0) && (
                        <div className="space-y-2">
                            {attachments.map((attachment) => (
                                <div key={attachment.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-muted/20 p-2">
                                    <div className="min-w-0 flex-1">
                                        <AttachmentPreviewCard
                                            fileName={attachment.file.filename}
                                            href={getPublicUrl(attachment.file.path)}
                                            kind={getAttachmentPreviewKind(attachment.file.mimeType, attachment.file.filename)}
                                            fileSize={attachment.file.size}
                                            compact
                                            compactDownload
                                        />
                                    </div>
                                    {!isCorrectingFinalizedGrade && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            icon={Trash2}
                                            title="Remove answerbook attachment"
                                            isLoading={deletingAttachmentId === attachment.id}
                                            disabled={Boolean(deletingAttachmentId)}
                                            onClick={() => setAttachmentToDelete(attachment)}
                                        />
                                    )}
                                </div>
                            ))}
                            {pendingFiles.map((file, index) => (
                                <div key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center gap-3 rounded-md border border-dashed border-primary/35 bg-primary/5 px-3 py-2">
                                    <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-foreground">{file.name}</p>
                                        <p className="text-xs font-semibold text-muted-foreground">Pending upload | {formatBytes(file.size)}</p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        icon={Trash2}
                                        title="Remove pending file"
                                        onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isCorrectingFinalizedGrade && (
                    <div className="space-y-2 md:space-y-3">
                        <Label htmlFor="correctionReason">Correction Reason</Label>
                        <Textarea
                            id="correctionReason"
                            {...register('correctionReason')}
                            icon={MessageCircle}
                            placeholder="Explain why this finalized grade is being corrected."
                            className="min-h-24 font-medium"
                        />
                        {errors.correctionReason && <p className="text-xs text-danger font-semibold">{errors.correctionReason.message}</p>}
                    </div>
                )}
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
        <ConfirmDialog
            isOpen={Boolean(attachmentToDelete)}
            onClose={() => setAttachmentToDelete(null)}
            onConfirm={() => attachmentToDelete ? removeAttachment(attachmentToDelete) : undefined}
            title="Remove answerbook attachment?"
            description="The file will no longer be available with this grade. Archived or finalized evidence cannot be removed."
            confirmText="Remove attachment"
            isDestructive
        />
        </>
    );
}
