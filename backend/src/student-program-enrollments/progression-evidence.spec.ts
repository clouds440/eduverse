import { AttendanceStatus, CourseRequirementType, GradeStatus } from '@/prisma/prisma-client';
import { buildStageEvidence } from './progression-evidence';

describe('buildStageEvidence', () => {
  const requirement = { courseId: 'course-1', courseCode: 'CS101', courseName: 'Computing', requirementType: CourseRequirementType.REQUIRED, creditHoursSnapshot: 3 };

  it('uses finalized weighted grades and attendance as immutable progression evidence', () => {
    const result = buildStageEvidence({
      requirements: [requirement],
      assessments: [
        { courseId: 'course-1', totalMarks: 100, weightage: 40, grade: { status: GradeStatus.FINALIZED, marksObtained: 70 } },
        { courseId: 'course-1', totalMarks: 100, weightage: 60, grade: { status: GradeStatus.FINALIZED, marksObtained: 80 } },
      ],
      attendance: [AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.ABSENT],
      minimumPassingPercentage: 50,
      minimumAttendancePercentage: 60,
    });
    expect(result.eligibleToComplete).toBe(true);
    expect(result.courses[0].percentage).toBe(76);
    expect(result.earnedCredits).toBe(3);
    expect(result.attendancePercentage).toBe(66.67);
  });

  it('returns explicit blockers for missing final evidence', () => {
    const result = buildStageEvidence({
      requirements: [requirement],
      assessments: [{ courseId: 'course-1', totalMarks: 100, weightage: 100, grade: { status: GradeStatus.DRAFT, marksObtained: 90 } }],
      attendance: [],
      minimumPassingPercentage: 50,
      minimumAttendancePercentage: 75,
    });
    expect(result.blockers.map((blocker) => blocker.code)).toEqual(['UNFINALIZED_GRADES', 'ATTENDANCE_BELOW_MINIMUM']);
  });

  it('counts an elective group minimum instead of every available elective as required credit', () => {
    const electives = ['course-1', 'course-2', 'course-3'].map((courseId, index) => ({
      courseId,
      courseCode: `EL${index + 1}`,
      courseName: `Elective ${index + 1}`,
      requirementType: CourseRequirementType.ELECTIVE,
      groupKey: 'technical',
      minCourses: 1,
      minCredits: 3,
      creditHoursSnapshot: 3,
    }));
    const result = buildStageEvidence({
      requirements: electives,
      assessments: [{ courseId: 'course-1', totalMarks: 100, weightage: 100, grade: { status: GradeStatus.FINALIZED, marksObtained: 80 } }],
      attendance: [],
      minimumPassingPercentage: 50,
    });
    expect(result.eligibleToComplete).toBe(true);
    expect(result.earnedCredits).toBe(3);
    expect(result.requiredCredits).toBe(3);
  });
});
