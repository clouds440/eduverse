import { Injectable } from '@nestjs/common';
import { CourseResultComponentType } from '@/prisma/prisma-client';
import type { CourseResultSchemeWithComponents } from './course-result-schemes.service';

export interface TranscriptSectionResult {
  sectionId: string;
  sectionName: string;
  sectionColor: string | null;
  courseId: string;
  courseName: string;
  creditHours: number;
  enrollmentType: string;
  wasExcluded: boolean;
  grades: unknown[];
  totalPercentage: number;
  letterGrade: string;
  gradePoints: number;
  qualityPoints: number;
  [key: string]: unknown;
}

export interface TranscriptComponentResult {
  componentType: CourseResultComponentType;
  label: string;
  weight: number;
  sectionId: string | null;
  sectionName: string | null;
  sectionColor: string | null;
  totalPercentage: number | null;
  weightedContribution: number | null;
  letterGrade: string;
  gradePoints: number;
  isMissing: boolean;
}

export interface TranscriptAggregateResult extends TranscriptSectionResult {
  resultKind: 'SECTION' | 'COMPONENT_AGGREGATE';
  schemeId?: string;
  isComplete?: boolean;
  components?: TranscriptComponentResult[];
}

@Injectable()
export class CourseResultAggregationService {
  aggregateTranscriptSections(
    sections: TranscriptSectionResult[],
    schemes: CourseResultSchemeWithComponents[],
  ): TranscriptAggregateResult[] {
    const schemeBySectionId = new Map<string, CourseResultSchemeWithComponents>();
    for (const scheme of schemes) {
      for (const component of scheme.components) {
        for (const link of component.sectionLinks) {
          schemeBySectionId.set(link.sectionId, scheme);
        }
      }
    }

    const emittedSchemeIds = new Set<string>();
    const rows: TranscriptAggregateResult[] = [];

    for (const section of sections) {
      const scheme = schemeBySectionId.get(section.sectionId);
      if (!scheme) {
        rows.push({ ...section, resultKind: 'SECTION' });
        continue;
      }
      if (emittedSchemeIds.has(scheme.id)) continue;
      emittedSchemeIds.add(scheme.id);
      rows.push(this.aggregateScheme(section, sections, scheme));
    }

    return rows;
  }

  private aggregateScheme(
    fallbackSection: TranscriptSectionResult,
    allSections: TranscriptSectionResult[],
    scheme: CourseResultSchemeWithComponents,
  ): TranscriptAggregateResult {
    const sectionById = new Map(allSections.map((section) => [section.sectionId, section]));
    let totalPercentage = 0;
    let anyExcluded = false;
    let hasAnyGrades = false;

    const components = scheme.components.map((component): TranscriptComponentResult => {
      const matchingSections = component.sectionLinks
        .map((link) => sectionById.get(link.sectionId) || null)
        .filter((section): section is TranscriptSectionResult => Boolean(section));
      const gradedSections = matchingSections.filter((section) => section.grades.length > 0 && !section.wasExcluded);
      anyExcluded = anyExcluded || matchingSections.some((section) => section.wasExcluded);
      hasAnyGrades = hasAnyGrades || gradedSections.length > 0;

      if (gradedSections.length === 0) {
        return {
          componentType: component.componentType,
          label: component.label,
          weight: component.weight,
          sectionId: null,
          sectionName: null,
          sectionColor: null,
          totalPercentage: null,
          weightedContribution: null,
          letterGrade: 'N/A',
          gradePoints: 0,
          isMissing: true,
        };
      }

      const averagePercentage = Number((gradedSections.reduce((sum, section) => sum + section.totalPercentage, 0) / gradedSections.length).toFixed(2));
      const weightedContribution = Number(((averagePercentage * component.weight) / 100).toFixed(2));
      totalPercentage += weightedContribution;
      const representative = gradedSections[0];

      return {
        componentType: component.componentType,
        label: component.label,
        weight: component.weight,
        sectionId: representative.sectionId,
        sectionName: representative.sectionName,
        sectionColor: representative.sectionColor,
        totalPercentage: averagePercentage,
        weightedContribution,
        letterGrade: representative.letterGrade,
        gradePoints: representative.gradePoints,
        isMissing: false,
      };
    });

    const isComplete = components.every((component) => !component.isMissing);
    return {
      ...fallbackSection,
      sectionId: `scheme:${scheme.id}`,
      sectionName: scheme.name,
      sectionColor: fallbackSection.sectionColor,
      courseId: scheme.courseId,
      courseName: scheme.course.name,
      creditHours: scheme.course.creditHours,
      enrollmentType: 'COMPONENT_AGGREGATE',
      wasExcluded: anyExcluded,
      grades: [],
      totalPercentage: Number(totalPercentage.toFixed(2)),
      letterGrade: isComplete && hasAnyGrades ? fallbackSection.letterGrade : 'N/A',
      gradePoints: 0,
      qualityPoints: 0,
      resultKind: 'COMPONENT_AGGREGATE',
      schemeId: scheme.id,
      isComplete,
      components,
    };
  }
}
