import React from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { cn, getPublicUrl } from '@/lib/utils';
import { ModalOverlay } from './Modal';
import { Button } from './Button';


export interface DataField {
    label: string;
    value: React.ReactNode;
    icon?: React.ElementType | string;
    fullWidth?: boolean;
}

interface DataViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    fields: DataField[];
    body?: React.ReactNode;
    bodyClassName?: string;
    actions?: React.ReactNode;
}

export function DataViewModal({ isOpen, onClose, title, subtitle, fields, body, bodyClassName, actions }: DataViewModalProps) {
    return (
        <ModalOverlay
            isOpen={isOpen}
            onBack={onClose}
            backLabel={title || 'Details'}
            maxWidth="max-w-4xl"
            className="p-0"
            mobileMode="sheet"
            ariaLabel={title || 'Details'}
        >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 bg-card/80 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">{title}</h2>
                    {subtitle && <p className="mt-1.5 text-xs font-medium text-muted-foreground">{subtitle}</p>}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Close details"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {fields.length > 0 && (
                    <div className="border-b border-border/60 bg-muted/20 p-4 sm:p-5">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            {fields.map((field, idx) => (
                                <div key={idx} className={cn(field.fullWidth && 'col-span-1 lg:col-span-2', 'rounded-md border border-border/55 bg-card/75 p-3')}>
                                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {field.icon && (typeof field.icon === 'string' ? <Image src={getPublicUrl(field.icon)} alt="Org Logo/Icon" width={24} height={24} className="w-6 h-6 rounded-full object-contain" /> : <field.icon className="w-3.5 h-3.5" />)}
                                        {field.label}
                                    </div>
                                    <div className="wrap-break-word text-sm font-medium leading-6 text-foreground">
                                        {field.value || <span className="text-muted-foreground">Not available</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {body && (
                    <div className={cn('p-4 sm:p-5', bodyClassName)}>
                        {body}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border/60 bg-card/80 p-4">
                {actions}
                <Button
                    onClick={onClose}
                    variant='secondary'
                    size="sm"
                >
                    Close
                </Button>
            </div>
        </ModalOverlay>
    );
}
