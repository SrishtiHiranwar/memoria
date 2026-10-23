import { HttpError } from '../lib/errors.js';

export type StoryStatus = 'DRAFT' | 'APPROVED' | 'ASSIGNED' | 'COMPLETED';

export function requireStoryTransition(current: string, target: StoryStatus) {
  const allowed: Record<StoryStatus, StoryStatus | null> = {
    DRAFT: 'APPROVED',
    APPROVED: 'ASSIGNED',
    ASSIGNED: 'COMPLETED',
    COMPLETED: null,
  };
  if (allowed[current as StoryStatus] !== target) {
    throw new HttpError(409, `This story cannot move from ${current} to ${target}.`);
  }
}
