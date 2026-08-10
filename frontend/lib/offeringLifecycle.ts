import { CohortOfferingStatus, ProgramOfferingStatus, ProgramStageOfferingStatus } from '@/types';

const transitions = {
    program: {
        [ProgramOfferingStatus.DRAFT]: [ProgramOfferingStatus.OPEN, ProgramOfferingStatus.CANCELLED],
        [ProgramOfferingStatus.OPEN]: [ProgramOfferingStatus.CLOSED, ProgramOfferingStatus.CANCELLED],
        [ProgramOfferingStatus.CLOSED]: [],
        [ProgramOfferingStatus.CANCELLED]: [],
    },
    stage: {
        [ProgramStageOfferingStatus.PLANNED]: [ProgramStageOfferingStatus.OPEN, ProgramStageOfferingStatus.CANCELLED],
        [ProgramStageOfferingStatus.OPEN]: [ProgramStageOfferingStatus.CLOSED, ProgramStageOfferingStatus.CANCELLED],
        [ProgramStageOfferingStatus.CLOSED]: [],
        [ProgramStageOfferingStatus.CANCELLED]: [],
    },
    cohort: {
        [CohortOfferingStatus.PLANNED]: [CohortOfferingStatus.ACTIVE, CohortOfferingStatus.CANCELLED],
        [CohortOfferingStatus.ACTIVE]: [CohortOfferingStatus.CLOSED, CohortOfferingStatus.CANCELLED],
        [CohortOfferingStatus.CLOSED]: [],
        [CohortOfferingStatus.CANCELLED]: [],
    },
} as const;

export function lifecycleOptions<T extends string>(current: T, allowed: readonly T[]) {
    return [current, ...allowed].map((value) => ({ value, label: value }));
}

export const programOfferingStatusOptions = (current: ProgramOfferingStatus) => lifecycleOptions(current, transitions.program[current]);
export const programStageOfferingStatusOptions = (current: ProgramStageOfferingStatus) => lifecycleOptions(current, transitions.stage[current]);
export const cohortOfferingStatusOptions = (current: CohortOfferingStatus) => lifecycleOptions(current, transitions.cohort[current]);
