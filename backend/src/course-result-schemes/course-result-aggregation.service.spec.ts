import { CourseResultComponentType } from '@/prisma/prisma-client';
import { CourseResultAggregationService, TranscriptSectionResult } from './course-result-aggregation.service';

function section(overrides: Partial<TranscriptSectionResult>): TranscriptSectionResult {
  return {
    sectionId: 'section-1',
    sectionName: 'A',
    sectionColor: '#3B82F6',
    courseId: 'course-1',
    courseName: 'Physics',
    creditHours: 3,
    enrollmentType: 'MANUAL',
    wasExcluded: false,
    grades: [{}],
    totalPercentage: 82,
    letterGrade: 'B',
    gradePoints: 3,
    qualityPoints: 9,
    ...overrides,
  };
}

function scheme() {
  return {
    id: 'scheme-1',
    courseId: 'course-1',
    course: { id: 'course-1', name: 'Physics', code: 'PHY', creditHours: 3, departmentId: null },
    components: [
      {
        componentType: CourseResultComponentType.THEORY,
        label: 'Theory',
        weight: 75,
        sortOrder: 0,
        sectionLinks: [{ sectionId: 'theory-section' }],
      },
      {
        componentType: CourseResultComponentType.LAB,
        label: 'Lab',
        weight: 25,
        sortOrder: 1,
        sectionLinks: [{ sectionId: 'lab-section' }],
      },
    ],
  } as never;
}

describe('CourseResultAggregationService', () => {
  const service = new CourseResultAggregationService();

  it('aggregates independent theory and lab section results by configured weight', () => {
    const rows = service.aggregateTranscriptSections([
      section({ sectionId: 'theory-section', sectionName: 'Theory A', totalPercentage: 82 }),
      section({ sectionId: 'lab-section', sectionName: 'Lab A', totalPercentage: 90, letterGrade: 'A' }),
    ], [scheme()]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      resultKind: 'COMPONENT_AGGREGATE',
      courseName: 'Physics',
      totalPercentage: 84,
      isComplete: true,
    });
    expect(rows[0].components).toEqual([
      expect.objectContaining({ componentType: CourseResultComponentType.THEORY, totalPercentage: 82, weightedContribution: 61.5 }),
      expect.objectContaining({ componentType: CourseResultComponentType.LAB, totalPercentage: 90, weightedContribution: 22.5 }),
    ]);
  });

  it('marks the aggregate incomplete when a configured component result is missing', () => {
    const rows = service.aggregateTranscriptSections([
      section({ sectionId: 'theory-section', sectionName: 'Theory A', totalPercentage: 82 }),
    ], [scheme()]);

    expect(rows[0]).toMatchObject({
      resultKind: 'COMPONENT_AGGREGATE',
      totalPercentage: 61.5,
      isComplete: false,
      letterGrade: 'N/A',
    });
    expect(rows[0].components?.[1]).toMatchObject({
      componentType: CourseResultComponentType.LAB,
      isMissing: true,
      totalPercentage: null,
      weightedContribution: null,
    });
  });
});
