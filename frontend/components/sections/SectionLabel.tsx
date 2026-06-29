'use client';

import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from 'react';
import type { Course, Section } from '@/types';
import { cn, getCourseSectionLabelParts, getSectionColor, getSectionTextStyle } from '@/lib/utils';

type SectionLike = {
    name?: string | null;
    code?: string | null;
    color?: string | null;
    course?: { name?: string | null; code?: string | null } | null;
};

interface CourseSectionLabelProps<T extends ElementType = 'span'> {
    section?: SectionLike | null;
    courseName?: string | null;
    courseCode?: string | null;
    sectionName?: string | null;
    sectionCode?: string | null;
    color?: string | null;
    as?: T;
    className?: string;
    variant?: 'inline' | 'stacked';
}

export function CourseSectionLabel<T extends ElementType = 'span'>({
    section,
    courseName,
    courseCode,
    sectionName,
    sectionCode,
    color,
    as,
    className,
    variant = 'inline',
    ...props
}: CourseSectionLabelProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof CourseSectionLabelProps<T>>) {
    const Component = as || 'span';
    const { style, ...restProps } = props as ComponentPropsWithoutRef<T> & { style?: CSSProperties };
    const resolvedColor = color ?? section?.color;
    const parts = getCourseSectionLabelParts({
        courseName: courseName ?? section?.course?.name,
        courseCode: courseCode ?? section?.course?.code,
        sectionName: sectionName ?? section?.name,
        sectionCode: sectionCode ?? section?.code,
    });

    if (variant === 'stacked') {
        return (
            <Component
                className={cn('flex min-w-0 flex-col leading-tight', className)}
                style={style}
                {...restProps}
            >
                {parts.sectionName && (
                    <span className="min-w-0 truncate font-black" style={{ color: getSectionColor(resolvedColor) }}>
                        {parts.sectionName}
                    </span>
                )}
                {parts.courseName && (
                    <span className="min-w-0 truncate text-[0.85em] font-bold opacity-70" style={{ color: getSectionColor(resolvedColor) }}>
                        {parts.courseName}
                    </span>
                )}
                {!parts.courseName && !parts.sectionName && (
                    <span className="min-w-0 truncate font-black" style={{ color: getSectionColor(resolvedColor) }}>
                        {parts.inlineLabel}
                    </span>
                )}
            </Component>
        );
    }

    return (
        <Component
            className={cn('min-w-0', className)}
            style={{
                ...getSectionTextStyle(resolvedColor),
                ...style,
            }}
            {...restProps}
        >
            {parts.inlineLabel}
        </Component>
    );
}





