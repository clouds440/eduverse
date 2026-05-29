'use client';

import * as React from 'react';
import { LucideIcon, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Label } from './Label';
import { PageHeader } from './PageShell';

export const FORM_INPUT_CLASS = 'h-12 border-border/60 bg-background/70 font-medium';
export const FORM_READONLY_INPUT_CLASS = 'h-12 border-border/60 bg-muted/40 font-medium opacity-70 cursor-not-allowed';

interface FormSectionProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}

interface FormPageHeaderProps {
    title: string;
    description: string;
    icon: LucideIcon;
    className?: string;
}

export function FormPageHeader({ title, description, icon: Icon, className }: FormPageHeaderProps) {
    return (
        <PageHeader title={title} description={description} icon={Icon} className={className} />
    );
}

export function FormSection({
    title,
    description,
    icon: Icon,
    children,
    className,
    bodyClassName,
}: FormSectionProps) {
    return (
        <section className={cn(
            'overflow-hidden rounded-2xl border border-border/70 bg-card/80 text-card-text shadow-sm',
            className
        )}>
            <header className="border-b border-border/60 bg-background/45 px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary">
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-base font-black text-foreground">{title}</h2>
                        {description && (
                            <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                </div>
            </header>
            <div className={cn('p-4 sm:p-5', bodyClassName)}>
                {children}
            </div>
        </section>
    );
}

interface FormFieldProps {
    label: string;
    required?: boolean;
    error?: React.ReactNode;
    helper?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export function FormField({
    label,
    required,
    error,
    helper,
    children,
    className,
}: FormFieldProps) {
    return (
        <div className={cn('space-y-2', className)}>
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {label}
                {required && <span className="ml-1 text-danger">*</span>}
            </Label>
            {children}
            {error ? (
                <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>
            ) : helper ? (
                <p className="text-xs font-semibold leading-relaxed text-muted-foreground">{helper}</p>
            ) : null}
        </div>
    );
}

interface FormGridProps {
    children: React.ReactNode;
    columns?: 1 | 2 | 3;
    className?: string;
}

const GRID_COLUMNS: Record<NonNullable<FormGridProps['columns']>, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
};

export function FormGrid({ children, columns = 2, className }: FormGridProps) {
    return (
        <div className={cn('grid grid-cols-1 gap-4 md:gap-5', GRID_COLUMNS[columns], className)}>
            {children}
        </div>
    );
}

interface FormActionsProps {
    cancelText?: string;
    submitText?: string;
    loadingId?: string;
    loadingText?: string;
    showSubmit?: boolean;
    title?: string;
    description?: string;
    onCancel: () => void;
}

export function FormActions({
    cancelText = 'Cancel',
    submitText = 'Save',
    loadingId,
    loadingText = 'Saving...',
    showSubmit = true,
    title = 'Save changes',
    description = 'Review and save the updates for this record.',
    onCancel,
}: FormActionsProps) {
    return (
        <div className="sticky bottom-3 z-20 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 px-3">
                    <p className="text-sm font-black text-foreground">{title}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{description}</p>
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                    <Button type="button" variant="secondary" onClick={onCancel} className="h-12 w-full px-6 text-sm font-semibold sm:w-auto">
                        {cancelText}
                    </Button>
                    {showSubmit && (
                        <Button type="submit" loadingId={loadingId} loadingText={loadingText} className="h-12 w-full px-6 text-sm font-semibold sm:w-auto" icon={Save}>
                            {submitText}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

interface FormPageShellProps {
    children: React.ReactNode;
    className?: string;
}

export function FormPageShell({ children, className }: FormPageShellProps) {
    return (
        <div className={cn('mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 pb-8', className)}>
            {children}
        </div>
    );
}
