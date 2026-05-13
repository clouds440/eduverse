import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    /** Width — accepts any CSS value */
    width?: string;
    /** Height — accepts any CSS value */
    height?: string;
}

/**
 * Base shimmer skeleton — use directly or via preset components below.
 */
export function Skeleton({ className, width, height }: SkeletonProps) {
    return (
        <div
            className={cn(
                "rounded-md skeleton-shimmer",
                className,
            )}
            style={{ width, height }}
            aria-hidden="true"
        />
    );
}

/** Dashboard Overview Skeleton */
export function DashboardSkeleton() {
    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-card rounded-3xl p-6 border border-border shadow-sm space-y-4">
                        <div className="flex justify-between items-start">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="w-10 h-10 rounded-2xl" />
                        </div>
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-full" />
                    </div>
                ))}
            </div>

            {/* Main Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Large Chart Area */}
                <div className="lg:col-span-2 bg-card rounded-3xl border border-border p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <Skeleton className="h-6 w-48" />
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-24 rounded-xl" />
                            <Skeleton className="h-8 w-24 rounded-xl" />
                        </div>
                    </div>
                    <Skeleton className="h-75 w-full rounded-2xl" />
                </div>

                {/* Right Sidebar List */}
                <div className="bg-card rounded-3xl border border-border p-6 space-y-6">
                    <Skeleton className="h-6 w-32" />
                    <div className="space-y-4">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-3 w-2/3" />
                                    <Skeleton className="h-2 w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Preset Variants ──────────────────────────────────────────────── */

/** Circular skeleton for avatars */
export function SkeletonAvatar({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
    const sizeMap = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
    return <Skeleton className={cn("rounded-full shrink-0", sizeMap[size], className)} />;
}

/** Single line of text */
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className="h-4"
                    width={i === lines - 1 && lines > 1 ? '60%' : '100%'}
                />
            ))}
        </div>
    );
}

/** Card-shaped skeleton */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={cn(
            "rounded-lg border border-(--border-color) p-5 space-y-4",
            className,
        )}>
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-3 pt-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
            </div>
        </div>
    );
}

/** Table row skeleton */
export function SkeletonTableRow({ columns = 4, className }: { columns?: number; className?: string }) {
    return (
        <div className={cn("flex items-center gap-4 h-20 px-4", className)}>
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton
                    key={i}
                    className="h-4 flex-1"
                    width={i === 0 ? '40%' : undefined}
                />
            ))}
        </div>
    );
}

/** Multiple table rows */
export function SkeletonTable({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
    return (
        <div className={cn("divide-y divide-border border border-border rounded-md", className)}>
            {/* Header */}
            <div className="flex items-center gap-4 h-16 px-4 bg-primary/10">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonTableRow key={i} columns={columns} />
            ))}
        </div>
    );
}
