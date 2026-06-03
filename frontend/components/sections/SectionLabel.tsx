'use client';

import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from 'react';
import type { Course, Section } from '@/types';
import { cn, formatCourseSectionLabel, getSectionTextStyle } from '@/lib/utils';

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
}

export function CourseSectionLabel<T extends ElementType = 'span'>({
    section,
    courseName,
    sectionName,
    color,
    as,
    className,
    ...props
}: CourseSectionLabelProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof CourseSectionLabelProps<T>>) {
    const Component = as || 'span';
    const { style, ...restProps } = props as ComponentPropsWithoutRef<T> & { style?: CSSProperties };
    const label = formatCourseSectionLabel({
        courseName: courseName ?? section?.course?.name,
        sectionName: sectionName ?? section?.name,
    });

    return (
        <Component
            className={cn('min-w-0', className)}
            style={{
                ...getSectionTextStyle(color ?? section?.color),
                ...style,
            }}
            {...restProps}
        >
            {label}
        </Component>
    );
}
