'use client';

import React from 'react';
import { CheckCircle, AlertTriangle, ShieldAlert, MessageSquare } from 'lucide-react';
import type { StatusBannerVariant } from '@/types';

export interface MailTemplate {
    id: string;
    name: string;
    subject?: string;
    content: string;
    icon: React.ElementType;
    variant: StatusBannerVariant;
}

export const ADMIN_REPLY_TEMPLATES: MailTemplate[] = [
    {
        id: 'approve',
        name: 'Approval Welcome',
        subject: 'Organization Application Approved',
        content: `Congratulations! Your organization application has been approved. 

You can now log in to your dashboard and start setting up your courses, teachers, and students. 

If you have any questions, feel free to reply to this mail thread.`,
        icon: CheckCircle,
        variant: 'success'
    },
    {
        id: 'reject',
        name: 'Rejection Notice',
        subject: 'Application Status Update',
        content: `Thank you for your interest in our platform. 

Unfortunately, after careful review of your application, we are unable to approve your organization at this time. 

**Reasons for rejection:**
- [REASON 1]
- [REASON 2]

You may update your details and re-apply in the future.`,
        icon: AlertTriangle,
        variant: 'danger'
    },
    {
        id: 'suspend',
        name: 'Suspension Notice',
        subject: 'Account Suspension Notice',
        content: `This is a formal notice that your organization account has been suspended effective immediately.

**Reason for suspension:**
[INSERT DETAILED REASON HERE]

During suspension, your staff and students will not be able to access the platform. Please contact support or reply to this thread to resolve this issue.`,
        icon: ShieldAlert,
        variant: 'warning'
    },
    {
        id: 'request_info',
        name: 'Request More Info',
        content: `We have received your request, but we need some additional information to proceed.

Could you please provide:
1. [DETAIL 1]
2. [DETAIL 2]

Once received, we will process your request as soon as possible.`,
        icon: MessageSquare,
        variant: 'info'
    }
];

interface MailTemplatesProps {
    onSelect: (content: string) => void;
    className?: string;
}

export function MailTemplates({ onSelect, className = '' }: MailTemplatesProps) {
    return (
        <div className={`space-y-3 ${className}`}>
            <p className="text-[10px] font-black text-muted-foreground tracking-widest mb-2">Quick Templates</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ADMIN_REPLY_TEMPLATES.map((template) => {
                    const Icon = template.icon;
                    return (
                        <button
                            key={template.id}
                            onClick={() => onSelect(template.content)}
                            className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all text-left group"
                        >
                            <div className={`p-2 rounded-lg shrink-0 ${template.variant === 'success' ? 'bg-success/10 text-success' :
                                    template.variant === 'danger' ? 'bg-danger/10 text-danger' :
                                        template.variant === 'warning' ? 'bg-warning/10 text-warning' :
                                            'bg-primary/10 text-primary'
                                }`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-black text-foreground truncate">{template.name}</p>
                                <p className="text-[9px] font-bold text-muted-foreground truncate">Click to insert</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
