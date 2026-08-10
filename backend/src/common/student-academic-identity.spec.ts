import { buildStudentAcademicIdentity, buildStudentProgramOverview } from './student-academic-identity';

describe('student academic identity', () => {
  it('prefers program, then cohort, then section', () => {
    const section = { enrollments: [{ section: { id: 'section-1', name: 'A', course: { name: 'Calculus' } } }] };
    expect(buildStudentAcademicIdentity(section).kind).toBe('SECTION');
    expect(buildStudentAcademicIdentity({ ...section, cohort: { id: 'cohort-1', name: 'Intake 2026' } }).kind).toBe('COHORT');
    expect(buildStudentAcademicIdentity({ ...section, cohort: { id: 'cohort-1', name: 'Intake 2026' }, majorProgramEnrollment: { program: { id: 'program-1', code: 'BSCS', name: 'Computer Science' } } }).kind).toBe('PROGRAM');
  });

  it('summarizes progress, credits, and duration-based graduation', () => {
    const result = buildStudentProgramOverview({
      id: 'major-1',
      admittedAt: '2026-08-01T00:00:00.000Z',
      requiredStageCountSnapshot: 2,
      program: { name: 'Computer Science', durationValue: 2, durationUnit: 'YEARS' },
      curriculumVersion: {
        name: '2026',
        stages: [
          { id: 'stage-1', sequence: 1, courseRequirements: [{ requirementType: 'REQUIRED', creditHoursSnapshot: 3 }] },
          { id: 'stage-2', sequence: 2, courseRequirements: [{ requirementType: 'REQUIRED', creditHoursSnapshot: 4 }] },
        ],
      },
      stageEnrollments: [{ programStageId: 'stage-1', status: 'COMPLETED' }],
    });
    expect(result).toMatchObject({ resolvedStageCount: 1, remainingStageCount: 1, progressPercentage: 50, completedCredits: 3, totalCredits: 7, expectedGraduationDate: '2028-08-01' });
  });
});
