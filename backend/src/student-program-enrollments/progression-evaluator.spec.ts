import {
  ProgramCompletionMode,
  ProgramProgressionMode,
  StudentProgressionOutcome,
  StudentStageEnrollmentStatus,
} from '@/prisma/prisma-client';
import { evaluateProgression } from './progression-evaluator';

const stages = [
  { id: 'one', code: 'S1', name: 'Stage 1', sequence: 1, isOptional: false, courseRequirements: [{ creditHoursSnapshot: 3 }] },
  { id: 'two', code: 'S2', name: 'Stage 2', sequence: 2, isOptional: false, courseRequirements: [{ creditHoursSnapshot: 4 }] },
  { id: 'three', code: 'S3', name: 'Stage 3', sequence: 3, isOptional: false, courseRequirements: [{ creditHoursSnapshot: 5 }] },
];

describe('evaluateProgression', () => {
  it('only exposes the next unresolved stage for sequential programs', () => {
    const result = evaluateProgression({
      progressionMode: ProgramProgressionMode.SEQUENTIAL,
      completionMode: ProgramCompletionMode.REQUIREMENTS,
      stages,
      attempts: [{ programStageId: 'one', status: StudentStageEnrollmentStatus.COMPLETED }],
    });
    expect(result.eligibleStageIds).toEqual(['two']);
    expect(result.recommendation).toBe(StudentProgressionOutcome.ADVANCE);
  });

  it('starts required progression at an advanced entry stage', () => {
    const result = evaluateProgression({
      progressionMode: ProgramProgressionMode.SEQUENTIAL,
      completionMode: ProgramCompletionMode.REQUIREMENTS,
      stages,
      entryStageId: 'two',
      attempts: [{ programStageId: 'two', status: StudentStageEnrollmentStatus.COMPLETED }],
    });
    expect(result.requiredStageIds).toEqual(['two', 'three']);
    expect(result.eligibleStageIds).toEqual(['three']);
  });

  it('blocks concurrent placement and derives credit completion from resolved stages', () => {
    const result = evaluateProgression({
      progressionMode: ProgramProgressionMode.CREDIT_ACCUMULATION,
      completionMode: ProgramCompletionMode.CREDITS,
      stages,
      attempts: stages.map((stage) => ({ programStageId: stage.id, status: StudentStageEnrollmentStatus.COMPLETED })),
    });
    expect(result.canCompleteProgram).toBe(true);
    expect(result.completedCredits).toBe(12);
    expect(result.requiredCredits).toBe(12);
    expect(result.recommendation).toBe(StudentProgressionOutcome.COMPLETE);
  });

  it('does not award completion credits for skipped stages', () => {
    const result = evaluateProgression({
      progressionMode: ProgramProgressionMode.CREDIT_ACCUMULATION,
      completionMode: ProgramCompletionMode.CREDITS,
      stages,
      attempts: stages.map((stage) => ({ programStageId: stage.id, status: StudentStageEnrollmentStatus.SKIPPED })),
    });
    expect(result.completedCredits).toBe(0);
    expect(result.canCompleteProgram).toBe(false);
  });
});
