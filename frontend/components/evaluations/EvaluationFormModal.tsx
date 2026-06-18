'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { EvaluationPendingTask, EvaluationType } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { StarRatingInput } from './StarRatingInput';

interface EvaluationFormModalProps {
    task: EvaluationPendingTask | null;
    isOpen: boolean;
    isSubmitting?: boolean;
    onClose: () => void;
    onSubmit: (payload: { rating: number; feedback?: string }) => Promise<void> | void;
}

export function EvaluationFormModal({ task, isOpen, isSubmitting, onClose, onSubmit }: EvaluationFormModalProps) {
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        setRating(task?.evaluation?.rating ?? 0);
        setFeedback(task?.evaluation?.feedback ?? '');
    }, [task]);

    if (!task) return null;

    const subject = task.type === EvaluationType.TEACHER
        ? task.teacher?.user?.name || task.teacher?.user?.email || 'Teacher'
        : task.course?.name || 'Course';
    const title = task.type === EvaluationType.TEACHER ? 'Teacher feedback' : 'Course feedback';
    const placeholder = task.type === EvaluationType.TEACHER
        ? 'What helped your learning? What could the teacher improve?'
        : 'What worked well in this course? What would make it better?';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            subtitle={`${subject} · ${task.section?.name || 'Section'}`}
            maxWidth="max-w-xl"
            footer={(
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        type="button"
                        icon={Send}
                        disabled={rating < 1}
                        isLoading={isSubmitting}
                        loadingText="Submitting"
                        onClick={() => onSubmit({ rating, feedback })}
                    >
                        {task.evaluation ? 'Update' : 'Submit'}
                    </Button>
                </div>
            )}
        >
            <div className="space-y-5">
                <div>
                    <p className="mb-2 text-sm font-bold text-foreground">Rating</p>
                    <StarRatingInput value={rating} onChange={setRating} size="lg" />
                </div>
                <div>
                    <p className="mb-2 text-sm font-bold text-foreground">Feedback</p>
                    <Textarea
                        icon={MessageSquare}
                        value={feedback}
                        maxLength={1200}
                        placeholder={placeholder}
                        onChange={(event) => setFeedback(event.target.value)}
                    />
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{feedback.length}/1200</p>
                </div>
            </div>
        </Modal>
    );
}
