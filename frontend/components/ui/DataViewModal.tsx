import React from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { getPublicUrl } from '@/lib/utils';
import { ModalOverlay } from './Modal';


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
    actions?: React.ReactNode;
}

export function DataViewModal({ isOpen, onClose, title, subtitle, fields, actions }: DataViewModalProps) {
    return (
        <ModalOverlay isOpen={isOpen} maxWidth="max-w-3xl" className="animate-scale-in p-0">
            {/* Header */}
            <div className="px-8 py-5 border-b border-card-text/10 bg-card-text/5 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-3xl font-black tracking-tight leading-none">{title}</h2>
                    {subtitle && <p className="text-xs font-bold opacity-40 mt-2 tracking-[0.2em]">{subtitle}</p>}
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-primary/10 rounded-lg transition-all group"
                >
                    <X className="w-8 h-8 opacity-40 group-hover:opacity-100 group-hover:text-dangertransition-all" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
                    {fields.map((field, idx) => (
                        <div key={idx} className={`${field.fullWidth ? 'col-span-1 md:col-span-2' : ''} space-y-3`}>
                            <div className="flex items-center gap-2 text-[11px] font-black opacity-80 tracking-[0.25em]">
                                {field.icon && (typeof field.icon === 'string' ? <Image src={getPublicUrl(field.icon)} alt="Org Logo/Icon" width={24} height={24} className="w-6 h-6 rounded-full object-contain" /> : <field.icon className="w-3.5 h-3.5" />)}
                                {field.label}
                            </div>
                            <div className="text-base font-bold wrap-break-word leading-relaxed">
                                {field.value || <span className="opacity-20 font-medium">Not available</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-card-text/10 bg-card-text/5 flex items-center justify-end gap-4 shrink-0">
                {actions}
                <button
                    onClick={onClose}
                    className="px-8 py-3.5 rounded-lg border border-card-text/20 text-xs font-black tracking-widest hover:bg-card-text/10 transition-all active:scale-95"
                >
                    Close
                </button>
            </div>
        </ModalOverlay>
    );
}
