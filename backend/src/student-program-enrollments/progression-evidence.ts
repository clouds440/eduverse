import { AttendanceStatus, CourseRequirementType, GradeStatus } from '@/prisma/prisma-client';

export interface EvidenceRequirement {
  courseId: string;
  courseCode: string;
  courseName: string;
  requirementType: CourseRequirementType;
  groupKey?: string | null;
  minCourses?: number | null;
  minCredits?: number | null;
  creditHoursSnapshot: number;
}

export interface EvidenceAssessment {
  courseId: string;
  totalMarks: number;
  weightage: number;
  grade?: { status: GradeStatus; marksObtained: number } | null;
}

export interface StageEvidenceSnapshot {
  eligibleToComplete: boolean;
  earnedCredits: number;
  requiredCredits: number;
  attendancePercentage: number | null;
  courses: Array<{
    courseId: string;
    courseCode: string;
    courseName: string;
    percentage: number | null;
    finalizedAssessments: number;
    assessmentCount: number;
    passed: boolean;
    credits: number;
  }>;
  blockers: Array<{ code: string; message: string; courseId?: string }>;
}

export function buildStageEvidence(input: {
  requirements: EvidenceRequirement[];
  assessments: EvidenceAssessment[];
  attendance: AttendanceStatus[];
  minimumPassingPercentage: number;
  minimumAttendancePercentage?: number | null;
  stageMinimumCredits?: number | null;
}): StageEvidenceSnapshot {
  const blockers: StageEvidenceSnapshot['blockers'] = [];
  const courses = input.requirements.map((requirement) => {
    const assessments = input.assessments.filter((assessment) => assessment.courseId === requirement.courseId);
    const finalized = assessments.filter((assessment) => assessment.grade?.status === GradeStatus.FINALIZED);
    const weightTotal = finalized.reduce((sum, assessment) => sum + assessment.weightage, 0);
    const weightedScore = finalized.reduce((sum, assessment) => {
      if (!assessment.grade || assessment.totalMarks <= 0) return sum;
      return sum + (assessment.grade.marksObtained / assessment.totalMarks) * assessment.weightage;
    }, 0);
    const percentage = weightTotal > 0 ? (weightedScore / weightTotal) * 100 : null;
    const passed = assessments.length > 0 && finalized.length === assessments.length && percentage !== null && percentage >= input.minimumPassingPercentage;
    return {
      courseId: requirement.courseId,
      courseCode: requirement.courseCode,
      courseName: requirement.courseName,
      percentage: percentage === null ? null : Number(percentage.toFixed(2)),
      finalizedAssessments: finalized.length,
      assessmentCount: assessments.length,
      passed,
      credits: passed ? requirement.creditHoursSnapshot : 0,
    };
  });

  for (const requirement of input.requirements.filter((row) => row.requirementType === CourseRequirementType.REQUIRED)) {
    const course = courses.find((row) => row.courseId === requirement.courseId)!;
    if (course.assessmentCount === 0) blockers.push({ code: 'NO_ASSESSMENTS', message: `${course.courseCode} has no assessments.`, courseId: course.courseId });
    else if (course.finalizedAssessments !== course.assessmentCount) blockers.push({ code: 'UNFINALIZED_GRADES', message: `${course.courseCode} still has unfinalized grades.`, courseId: course.courseId });
    else if (!course.passed) blockers.push({ code: 'COURSE_NOT_PASSED', message: `${course.courseCode} is below the ${input.minimumPassingPercentage}% pass threshold.`, courseId: course.courseId });
  }

  const electiveGroups = new Map<string, EvidenceRequirement[]>();
  for (const requirement of input.requirements.filter((row) => row.requirementType === CourseRequirementType.ELECTIVE)) {
    const key = requirement.groupKey || '__electives__';
    electiveGroups.set(key, [...(electiveGroups.get(key) || []), requirement]);
  }
  for (const [group, requirements] of electiveGroups) {
    const passed = requirements.map((requirement) => courses.find((course) => course.courseId === requirement.courseId)!).filter((course) => course.passed);
    const minimumCourses = Math.max(...requirements.map((row) => row.minCourses ?? 1));
    const minimumCredits = Math.max(...requirements.map((row) => row.minCredits ?? 0));
    const credits = passed.reduce((sum, course) => sum + course.credits, 0);
    if (passed.length < minimumCourses || credits < minimumCredits) {
      blockers.push({ code: 'ELECTIVE_GROUP_INCOMPLETE', message: `${group === '__electives__' ? 'Elective requirements' : group} requires ${minimumCourses} passed course(s) and ${minimumCredits} credit(s).` });
    }
  }

  const earnedCredits = courses.reduce((sum, course) => sum + course.credits, 0);
  const fixedRequiredCredits = input.requirements
    .filter((row) => row.requirementType === CourseRequirementType.REQUIRED)
    .reduce((sum, row) => sum + row.creditHoursSnapshot, 0);
  const electiveRequiredCredits = [...electiveGroups.values()].reduce((sum, requirements) => {
    const explicitMinimum = Math.max(...requirements.map((row) => row.minCredits ?? 0));
    if (explicitMinimum > 0) return sum + explicitMinimum;
    const minimumCourses = Math.max(...requirements.map((row) => row.minCourses ?? 1));
    return sum + [...requirements]
      .sort((a, b) => a.creditHoursSnapshot - b.creditHoursSnapshot)
      .slice(0, minimumCourses)
      .reduce((groupSum, row) => groupSum + row.creditHoursSnapshot, 0);
  }, 0);
  const requiredCredits = input.stageMinimumCredits ?? fixedRequiredCredits + electiveRequiredCredits;
  if (input.stageMinimumCredits != null && earnedCredits < input.stageMinimumCredits) {
    blockers.push({ code: 'STAGE_CREDITS_INCOMPLETE', message: `Earned ${earnedCredits} of ${input.stageMinimumCredits} required stage credits.` });
  }

  const countedAttendance = input.attendance.filter((status) => status !== AttendanceStatus.EXCUSED);
  const attended = countedAttendance.filter((status) => status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE).length;
  const attendancePercentage = countedAttendance.length ? Number(((attended / countedAttendance.length) * 100).toFixed(2)) : null;
  if (input.minimumAttendancePercentage != null && (attendancePercentage == null || attendancePercentage < input.minimumAttendancePercentage)) {
    blockers.push({ code: 'ATTENDANCE_BELOW_MINIMUM', message: `Attendance must be at least ${input.minimumAttendancePercentage}%.` });
  }

  return { eligibleToComplete: blockers.length === 0, earnedCredits, requiredCredits, attendancePercentage, courses, blockers };
}
