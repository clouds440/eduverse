'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingProps {
    text?: string;
    icon?: React.ElementType<{ className?: string }> | React.ReactNode;
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    fullScreen?: boolean;
}

const sizeMap = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
};

const textSizeMap = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
};

function renderLoadingIcon(
    icon: React.ElementType<{ className?: string }> | React.ReactNode | undefined,
    className: string,
) {
    if (!icon) {
        return <Loader2 className={className} aria-hidden="true" />;
    }

    if (React.isValidElement(icon)) {
        return icon;
    }

    if (
        typeof icon === 'function' ||
        (typeof icon === 'object' && icon !== null && '$$typeof' in icon)
    ) {
        const Icon = icon as React.ElementType<{ className?: string }>;
        return <Icon className={className} aria-hidden="true" />;
    }

    return icon;
}

export function Loading({
    text,
    icon,
    className = '',
    size = 'md',
    fullScreen = false
}: LoadingProps) {
    const containerClasses = fullScreen
        ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
        : "flex flex-col items-center justify-center py-3";

    const spinnerSize = sizeMap[size];
    const textSize = textSizeMap[size];

    return (
        <div className={cn(containerClasses, className)} role="status" aria-live="polite">
            {renderLoadingIcon(icon, cn(spinnerSize, "animate-spin text-primary"))}
            {text && (
                <p className={`mt-4 font-medium text-muted-foreground ${textSize}`}>
                    {text}
                </p>
            )}
            {!text && <span className="sr-only">Loading</span>}
        </div>
    );
}
