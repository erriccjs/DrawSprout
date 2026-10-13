/** Shared fixtures for engine and persistence tests. */

import { CAT_LESSON } from '../lesson-data/cat-lesson';
import type { LessonPackage } from '../lesson-data/schema';
import { createSession, reduceSession } from '../lesson-engine/session';
import type { SessionAction, SessionState, Stroke } from '../lesson-engine/types';

export const lesson: LessonPackage = CAT_LESSON;

export function newSessionState(): SessionState {
  return createSession(lesson, 'session-1');
}

/** Applies a list of actions in order, which keeps the tests readable. */
export function applyAll(state: SessionState, actions: readonly SessionAction[]): SessionState {
  return actions.reduce((current, action) => reduceSession(lesson, current, action), state);
}

let strokeCounter = 0;

export function strokeInput(
  stepId: string,
  overrides: Partial<Omit<Stroke, 'sequence'>> = {},
): Omit<Stroke, 'sequence'> {
  strokeCounter += 1;
  return {
    id: `stroke-${strokeCounter}`,
    stepId,
    layerId: 'ink',
    points: [
      { x: 10, y: 10 },
      { x: 20, y: 24 },
    ],
    color: '#3a3a3a',
    width: 8,
    tool: 'pen',
    clipRegionIds: [],
    ...overrides,
  };
}

export function draw(
  state: SessionState,
  stepId: string,
  overrides: Partial<Omit<Stroke, 'sequence'>> = {},
): SessionState {
  return reduceSession(lesson, state, { type: 'commit-stroke', stroke: strokeInput(stepId, overrides) });
}

export function stepIdAt(index: number): string {
  return lesson.steps[index]!.id;
}
