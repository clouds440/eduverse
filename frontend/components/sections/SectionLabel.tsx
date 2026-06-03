'use client';

import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from 'react';
import type { Course, Section } from '@/types';
import { cn, getCourseSectionLabelParts, getSectionColor, getSectionTextStyle } from '@/lib/utils';

type SectionLike = Pick<Section, 'name' | 'color'> & {
    course?: Pick<Course, 'name'> | null;
};

interface CourseSectionLabelProps<T extends ElementType = 'span'> {
    section?: SectionLike | null;
    courseName?: string | null;
    sectionName?: string | null;
    color?: string | null;
    as?: T;
    className?: string;
    variant?: 'inline' | 'stacked';
}

export function CourseSectionLabel<T extends ElementType = 'span'>({
    section,
    courseName,
    sectionName,
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
        sectionName: sectionName ?? section?.name,
    });

    if (variant === 'stacked') {
        return (
            <Component
                className={cn('flex min-w-0 flex-col leading-tight', className)}
                style={style}
                {...restProps}
            >
                {parts.courseName && (
                    <span className="min-w-0 truncate font-black" style={{ color: getSectionColor(resolvedColor) }}>
                        {parts.courseName}
                    </span>
                )}
                {parts.sectionName && (
                    <span className="min-w-0 truncate text-[0.85em] font-bold opacity-70" style={{ color: getSectionColor(resolvedColor) }}>
                        {parts.sectionName}
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
