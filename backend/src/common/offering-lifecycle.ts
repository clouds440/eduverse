import { ConflictException } from '@nestjs/common';
import {
  CohortOfferingStatus,
  ProgramOfferingStatus,
  ProgramStageOfferingStatus,
} from '@/prisma/prisma-client';

type TransitionMap<T extends string> = Record<T, readonly T[]>;

export const PROGRAM_OFFERING_TRANSITIONS: TransitionMap<ProgramOfferingStatus> = {
  DRAFT: ['PUBLISHED', 'OPEN', 'CANCELLED', 'ARCHIVED'],
  PUBLISHED: ['OPEN', 'CANCELLED', 'ARCHIVED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export const PROGRAM_STAGE_OFFERING_TRANSITIONS: TransitionMap<ProgramStageOfferingStatus> = {
  PLANNED: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export const COHORT_OFFERING_TRANSITIONS: TransitionMap<CohortOfferingStatus> = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['CLOSED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export function assertLifecycleTransition<T extends string>(
  current: T,
  next: T | undefined,
  transitions: TransitionMap<T>,
  label: string,
) {
  if (!next || next === current) return;
  if (!transitions[current].includes(next)) {
    throw new ConflictException(`${label} cannot move from ${current} to ${next}`);
  }
}
