type NamedEntity = { id?: string; name?: string | null; code?: string | null };

type StageRequirement = {
  requirementType?: string;
  groupKey?: string | null;
  minCourses?: number | null;
  minCredits?: number | null;
  creditHoursSnapshot?: number;
};

type CurriculumStage = NamedEntity & {
  sequence?: number;
  isOptional?: boolean;
  minCredits?: number | null;
  courseRequirements?: StageRequirement[];
};

type ProgramEnrollment = {
  id?: string;
  status?: string;
  admittedAt?: Date | string | null;
  startedAt?: Date | string | null;
  requiredStageCountSnapshot?: number;
  program?: NamedEntity & {
    durationValue?: number | null;
    durationUnit?: string | null;
    progressionMode?: string;
    completionMode?: string;
    department?: NamedEntity | null;
  };
  curriculumVersion?: NamedEntity & { stages?: CurriculumStage[] };
  stageEnrollments?: Array<{
    programStageId?: string;
    status?: string;
    stageNameSnapshot?: string;
    stageCodeSnapshot?: string;
    cycleNameSnapshot?: string;
    cycleCodeSnapshot?: string;
  }>;
};

export interface StudentAcademicIdentity {
  kind: 'PROGRAM' | 'COHORT' | 'SECTION' | 'UNASSIGNED';
  label: string;
  programId?: string;
  cohortId?: string;
  sectionId?: string;
  code?: string | null;
}

export function buildStudentAcademicIdentity(input: {
  majorProgramEnrollment?: ProgramEnrollment | null;
  currentCohortMembership?: { cohortOffering?: { cohort?: NamedEntity | null } | null } | null;
  cohort?: NamedEntity | null;
  enrollments?: Array<{ section?: NamedEntity & { course?: NamedEntity | null } } | null>;
}): StudentAcademicIdentity {
  const program = input.majorProgramEnrollment?.program;
  if (program) {
    return {
      kind: 'PROGRAM',
      label: entityLabel(program, 'Program'),
      programId: program.id,
      code: program.code,
    };
  }

  const cohort = input.currentCohortMembership?.cohortOffering?.cohort ?? input.cohort;
  if (cohort) {
    return {
      kind: 'COHORT',
      label: entityLabel(cohort, 'Cohort'),
      cohortId: cohort.id,
      code: cohort.code,
    };
  }

  const sections = (input.enrollments ?? [])
    .map((enrollment) => enrollment?.section)
    .filter((section): section is NonNullable<typeof section> => Boolean(section))
    .sort((a, b) => entityLabel(a, '').localeCompare(entityLabel(b, '')));
  const section = sections[0];
  if (section) {
    const course = section.course;
    return {
      kind: 'SECTION',
      label: [course ? entityLabel(course, '') : '', entityLabel(section, 'Section')].filter(Boolean).join(' - '),
      sectionId: section.id,
      code: section.code,
    };
  }

  return { kind: 'UNASSIGNED', label: 'No academic placement' };
}

export function buildStudentProgramOverview(
  enrollment: ProgramEnrollment | null | undefined,
  recordedGraduationDate?: Date | string | null,
) {
  if (!enrollment?.program) return null;
  const stages = [...(enrollment.curriculumVersion?.stages ?? [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const attempts = enrollment.stageEnrollments ?? [];
  const resolvedStageIds = new Set(attempts
    .filter((attempt) => attempt.status === 'COMPLETED' || attempt.status === 'SKIPPED')
    .map((attempt) => attempt.programStageId)
    .filter(Boolean));
  const completedStageIds = new Set(attempts
    .filter((attempt) => attempt.status === 'COMPLETED')
    .map((attempt) => attempt.programStageId)
    .filter(Boolean));
  const currentStage = attempts.find((attempt) => attempt.status === 'IN_PROGRESS') ?? null;
  const requiredStages = stages.filter((stage) => !stage.isOptional);
  const requiredStageCount = enrollment.requiredStageCountSnapshot ?? requiredStages.length;
  const resolvedStageCount = stages.length
    ? requiredStages.filter((stage) => stage.id && resolvedStageIds.has(stage.id)).length
    : attempts.filter((attempt) => attempt.status === 'COMPLETED' || attempt.status === 'SKIPPED').length;
  const totalCredits = requiredStages.reduce((sum, stage) => sum + stageCredits(stage), 0);
  const completedCredits = requiredStages
    .filter((stage) => stage.id && completedStageIds.has(stage.id))
    .reduce((sum, stage) => sum + stageCredits(stage), 0);
  const nextStage = stages.find((stage) => !stage.isOptional && stage.id && !resolvedStageIds.has(stage.id) && stage.id !== currentStage?.programStageId) ?? null;
  const expectedGraduation = graduationEstimate(enrollment, recordedGraduationDate);

  return {
    enrollmentId: enrollment.id,
    status: enrollment.status,
    program: enrollment.program,
    curriculum: enrollment.curriculumVersion ? {
      id: enrollment.curriculumVersion.id,
      name: enrollment.curriculumVersion.name,
      code: enrollment.curriculumVersion.code,
    } : null,
    admittedAt: enrollment.admittedAt ?? null,
    startedAt: enrollment.startedAt ?? null,
    duration: durationLabel(enrollment.program.durationValue, enrollment.program.durationUnit),
    expectedGraduationDate: expectedGraduation.date,
    graduationDateSource: expectedGraduation.source,
    requiredStageCount,
    resolvedStageCount,
    remainingStageCount: Math.max(0, requiredStageCount - resolvedStageCount),
    progressPercentage: requiredStageCount > 0 ? Math.round((resolvedStageCount / requiredStageCount) * 100) : 0,
    totalCredits,
    completedCredits,
    currentStage,
    nextStage: nextStage ? { id: nextStage.id, name: nextStage.name, code: nextStage.code, sequence: nextStage.sequence } : null,
    progressionMode: enrollment.program.progressionMode ?? null,
    completionMode: enrollment.program.completionMode ?? null,
  };
}

function stageCredits(stage: CurriculumStage) {
  if (stage.minCredits != null) return stage.minCredits;
  const requirements = stage.courseRequirements ?? [];
  const fixed = requirements
    .filter((requirement) => !requirement.requirementType || requirement.requirementType === 'REQUIRED')
    .reduce((sum, requirement) => sum + (requirement.creditHoursSnapshot ?? 0), 0);
  const groups = new Map<string, StageRequirement[]>();
  for (const requirement of requirements.filter((row) => row.requirementType === 'ELECTIVE')) {
    const key = requirement.groupKey || '__electives__';
    groups.set(key, [...(groups.get(key) ?? []), requirement]);
  }
  const elective = [...groups.values()].reduce((sum, group) => {
    const minimumCredits = Math.max(...group.map((row) => row.minCredits ?? 0));
    if (minimumCredits > 0) return sum + minimumCredits;
    const minimumCourses = Math.max(...group.map((row) => row.minCourses ?? 1));
    return sum + [...group]
      .sort((a, b) => (a.creditHoursSnapshot ?? 0) - (b.creditHoursSnapshot ?? 0))
      .slice(0, minimumCourses)
      .reduce((groupSum, row) => groupSum + (row.creditHoursSnapshot ?? 0), 0);
  }, 0);
  return fixed + elective;
}

function graduationEstimate(enrollment: ProgramEnrollment, recorded?: Date | string | null) {
  if (recorded) return { date: dateKey(recorded), source: 'RECORDED' as const };
  const value = enrollment.program?.durationValue;
  const unit = enrollment.program?.durationUnit;
  const start = enrollment.startedAt ?? enrollment.admittedAt;
  if (!value || !start || (unit !== 'MONTHS' && unit !== 'YEARS')) return { date: null, source: 'UNAVAILABLE' as const };
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return { date: null, source: 'UNAVAILABLE' as const };
  if (unit === 'YEARS') date.setUTCFullYear(date.getUTCFullYear() + value);
  else date.setUTCMonth(date.getUTCMonth() + value);
  return { date: dateKey(date), source: 'PROGRAM_DURATION_ESTIMATE' as const };
}

function durationLabel(value?: number | null, unit?: string | null) {
  if (!value || !unit) return null;
  const label = unit.toLowerCase();
  return `${value} ${value === 1 ? label.replace(/s$/, '') : label}`;
}

function dateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function entityLabel(entity: NamedEntity, fallback: string) {
  if (entity.code && entity.name) return `${entity.code} - ${entity.name}`;
  return entity.name || entity.code || fallback;
}
