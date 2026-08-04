import { PastRecordsService } from './past-records.service';

describe('PastRecordsService authorization projections', () => {
  const service = new PastRecordsService({} as never, {} as never);

  it('scopes teachers by snapshotted user assignment', () => {
    expect((service as any).archiveSectionScope({ departmentIds: null, teacherUserId: 'teacher-user-1', studentIds: null }))
      .toEqual({ teacherUserIds: { has: 'teacher-user-1' } });
  });

  it('scopes students and guardians through normalized student indexes', () => {
    expect((service as any).archiveSectionScope({ departmentIds: null, teacherUserId: null, studentIds: ['student-1', 'student-2'] }))
      .toEqual({ studentIndexes: { some: { sourceStudentId: { in: ['student-1', 'student-2'] } } } });
  });

  it('composes requested department filters with actor scope instead of overwriting it', () => {
    const where = (service as any).sectionWhere(
      'org-1',
      { departmentId: 'department-outside-scope' },
      { departmentIds: ['department-in-scope'], teacherUserId: null, studentIds: null },
    );

    expect(where.AND).toEqual([
      { sourceDepartmentId: { in: ['department-in-scope'] } },
      { sourceDepartmentId: 'department-outside-scope' },
    ]);
  });

  it('redacts every other student record from student and guardian payloads', () => {
    const payload = {
      enrollments: [{ studentId: 'student-1' }, { studentId: 'student-2' }],
      enrollmentHistories: [{ studentId: 'student-1' }, { studentId: 'student-2' }],
      assessments: [{ grades: [{ studentId: 'student-1' }, { studentId: 'student-2' }], submissions: [{ studentId: 'student-2' }] }],
      attendanceSessions: [{ records: [{ studentId: 'student-1' }, { studentId: 'student-2' }] }],
      evaluations: [{ studentId: 'student-1', feedback: 'private' }],
    };

    const result = (service as any).sanitizePayload(payload, { departmentIds: null, teacherUserId: null, studentIds: ['student-1'] }, 'archive-section-1');

    expect(result.enrollments).toEqual([{ studentId: 'student-1' }]);
    expect(result.enrollmentHistories).toEqual([{ studentId: 'student-1' }]);
    expect(result.assessments[0].grades).toEqual([expect.objectContaining({ studentId: 'student-1' })]);
    expect(result.assessments[0].submissions).toEqual([]);
    expect(result.attendanceSessions[0].records).toEqual([{ studentId: 'student-1' }]);
    expect(result.evaluations).toEqual([]);
  });
});
