import {
  ProgramCompletionMode,
  ProgramProgressionMode,
  StudentProgressionOutcome,
  StudentStageEnrollmentStatus,
  CourseRequirementType,
} from '@/prisma/prisma-client';

export interface ProgressionStage {
  id: string;
  code: string;
  name: string;
  sequence: number;
  isOptional: boolean;
  minCredits?: number | null;
  courseRequirements?: Array<{ creditHoursSnapshot: number; requirementType?: CourseRequirementType; groupKey?: string | null; minCourses?: number | null; minCredits?: number | null }>;
}

export interface ProgressionAttempt {
  programStageId: string;
  status: StudentStageEnrollmentStatus;
}

export interface ProgressionEvaluation {
  recommendation: StudentProgressionOutcome;
  eligibleStageIds: string[];
  nextStageIdsAfterResolution: string[];
  resolvedStageIds: string[];
  requiredStageIds: string[];
  canCompleteProgram: boolean;
  completedCredits: number;
  requiredCredits: number;
  blockers: Array<{ code: string; message: string }>;
}

const RESOLVED = new Set<StudentStageEnrollmentStatus>([
  StudentStageEnrollmentStatus.COMPLETED,
  StudentStageEnrollmentStatus.SKIPPED,
]);

export function evaluateProgression(input: {
  progressionMode: ProgramProgressionMode;
  completionMode: ProgramCompletionMode;
  stages: ProgressionStage[];
  attempts: ProgressionAttempt[];
  entryStageId?: string | null;
}): ProgressionEvaluation {
  const stages = [...input.stages].sort((a, b) => a.sequence - b.sequence);
  const entrySequence = stages.find((stage) => stage.id === input.entryStageId)?.sequence ?? stages[0]?.sequence ?? 0;
  const applicable = stages.filter((stage) => stage.sequence >= entrySequence);
  const resolved = new Set(input.attempts.filter((attempt) => RESOLVED.has(attempt.status)).map((attempt) => attempt.programStageId));
  const completed = new Set(input.attempts.filter((attempt) => attempt.status === StudentStageEnrollmentStatus.COMPLETED).map((attempt) => attempt.programStageId));
  const inProgress = new Set(input.attempts.filter((attempt) => attempt.status === StudentStageEnrollmentStatus.IN_PROGRESS).map((attempt) => attempt.programStageId));
  const required = applicable.filter((stage) => !stage.isOptional);
  const unresolved = applicable.filter((stage) => !resolved.has(stage.id) && !inProgress.has(stage.id));
  const stageCredits = (stage: ProgressionStage) => {
    if (stage.minCredits != null) return stage.minCredits;
    const requirements = stage.courseRequirements || [];
    const fixed = requirements.filter((row) => !row.requirementType || row.requirementType === CourseRequirementType.REQUIRED).reduce((sum, row) => sum + row.creditHoursSnapshot, 0);
    const groups = new Map<string, typeof requirements>();
    for (const row of requirements.filter((requirement) => requirement.requirementType === CourseRequirementType.ELECTIVE)) {
      const key = row.groupKey || '__electives__';
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    return fixed + [...groups.values()].reduce((sum, rows) => {
      const explicitCredits = Math.max(...rows.map((row) => row.minCredits ?? 0));
      if (explicitCredits) return sum + explicitCredits;
      const count = Math.max(...rows.map((row) => row.minCourses ?? 1));
      return sum + [...rows].sort((a, b) => a.creditHoursSnapshot - b.creditHoursSnapshot).slice(0, count).reduce((groupSum, row) => groupSum + row.creditHoursSnapshot, 0);
    }, 0);
  };
  const requiredCredits = required.reduce((sum, stage) => sum + stageCredits(stage), 0);
  const completedCredits = required.filter((stage) => completed.has(stage.id)).reduce((sum, stage) => sum + stageCredits(stage), 0);

  let eligible = unresolved;
  if (input.progressionMode === ProgramProgressionMode.SEQUENTIAL) {
    const nextRequired = required.find((stage) => !resolved.has(stage.id) && !inProgress.has(stage.id));
    eligible = nextRequired ? unresolved.filter((stage) => stage.isOptional || stage.id === nextRequired.id).filter((stage) => {
      return required.filter((requiredStage) => requiredStage.sequence < stage.sequence).every((requiredStage) => resolved.has(requiredStage.id));
    }) : unresolved.filter((stage) => stage.isOptional);
  }

  const resolvedAfterCurrent = new Set([...resolved, ...inProgress]);
  const unresolvedAfterCurrent = applicable.filter((stage) => !resolvedAfterCurrent.has(stage.id));
  let nextAfterResolution = unresolvedAfterCurrent;
  if (input.progressionMode === ProgramProgressionMode.SEQUENTIAL) {
    const nextRequired = required.find((stage) => !resolvedAfterCurrent.has(stage.id));
    nextAfterResolution = nextRequired ? unresolvedAfterCurrent.filter((stage) => stage.isOptional || stage.id === nextRequired.id).filter((stage) => {
      return required.filter((requiredStage) => requiredStage.sequence < stage.sequence).every((requiredStage) => resolvedAfterCurrent.has(requiredStage.id));
    }) : unresolvedAfterCurrent.filter((stage) => stage.isOptional);
  }

  let canCompleteProgram = false;
  if (input.completionMode === ProgramCompletionMode.FINAL_STAGE) {
    const finalRequired = required.at(-1);
    canCompleteProgram = Boolean(finalRequired && resolved.has(finalRequired.id));
  } else if (input.completionMode === ProgramCompletionMode.CREDITS) {
    canCompleteProgram = requiredCredits > 0 && completedCredits >= requiredCredits;
  } else if (input.completionMode === ProgramCompletionMode.REQUIREMENTS) {
    canCompleteProgram = required.every((stage) => resolved.has(stage.id));
  }

  const blockers: ProgressionEvaluation['blockers'] = [];
  if (inProgress.size) blockers.push({ code: 'STAGE_IN_PROGRESS', message: 'Resolve the current stage before starting another stage.' });
  if (input.progressionMode === ProgramProgressionMode.MANUAL) blockers.push({ code: 'MANUAL_PROGRESSION', message: 'This program requires an explicit operator progression decision.' });
  if (input.completionMode === ProgramCompletionMode.MANUAL) blockers.push({ code: 'MANUAL_COMPLETION', message: 'This program requires an explicit operator completion decision.' });

  return {
    recommendation: canCompleteProgram ? StudentProgressionOutcome.COMPLETE : eligible.length ? StudentProgressionOutcome.ADVANCE : StudentProgressionOutcome.REMAIN,
    eligibleStageIds: inProgress.size ? [] : eligible.map((stage) => stage.id),
    nextStageIdsAfterResolution: nextAfterResolution.map((stage) => stage.id),
    resolvedStageIds: [...resolved],
    requiredStageIds: required.map((stage) => stage.id),
    canCompleteProgram,
    completedCredits,
    requiredCredits,
    blockers,
  };
}
