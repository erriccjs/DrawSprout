/**
 * Conversion between engine state and the stored shapes.
 *
 * Pure functions, so a restore can be tested without a database.
 */

import type { SessionState, Stroke } from '../lesson-engine/types';
import { PERSISTENCE_SCHEMA_VERSION, type RestoredSession, type SessionCheckpoint } from './types';

export function toCheckpoint(state: SessionState, revision: number, now: number): SessionCheckpoint {
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    sessionId: state.sessionId,
    lessonId: state.lessonId,
    lessonContentVersion: state.lessonContentVersion,
    revision,
    updatedAt: now,
    currentStepIndex: state.currentStepIndex,
    assistanceMode: state.assistanceMode,
    hintDurationMs: state.hintDurationMs,
    inputMode: state.inputMode,
    toolPreferences: state.toolPreferences,
    nextSequence: state.nextSequence,
    finished: state.finished,
    committedStrokeIds: state.strokes.map((stroke) => stroke.id),
    redoStrokeIds: state.redoStack.map((stroke) => stroke.id),
  };
}

export class IncompatibleCheckpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompatibleCheckpointError';
  }
}

/**
 * Rebuilds engine state from a checkpoint plus the stroke log.
 *
 * A stroke id in the checkpoint with no matching log entry means the log is
 * incomplete; the session is refused rather than silently restored with holes
 * in the artwork (PRD section 13, "Integritas").
 */
export function fromRestoredSession(restored: RestoredSession): SessionState {
  const { checkpoint, strokes } = restored;

  if (checkpoint.schemaVersion !== PERSISTENCE_SCHEMA_VERSION) {
    throw new IncompatibleCheckpointError(
      `Checkpoint schema version ${checkpoint.schemaVersion} cannot be read by version ${PERSISTENCE_SCHEMA_VERSION}`,
    );
  }

  const byId = new Map<string, Stroke>(strokes.map((stroke) => [stroke.id, stroke]));
  const pick = (ids: readonly string[]): Stroke[] =>
    ids.map((id) => {
      const stroke = byId.get(id);
      if (!stroke) {
        throw new IncompatibleCheckpointError(`Stroke "${id}" is missing from the stroke log`);
      }
      return stroke;
    });

  return {
    sessionId: checkpoint.sessionId,
    lessonId: checkpoint.lessonId,
    lessonContentVersion: checkpoint.lessonContentVersion,
    currentStepIndex: checkpoint.currentStepIndex,
    assistanceMode: checkpoint.assistanceMode,
    hintDurationMs: checkpoint.hintDurationMs,
    inputMode: checkpoint.inputMode,
    toolPreferences: checkpoint.toolPreferences,
    strokes: pick(checkpoint.committedStrokeIds),
    redoStack: pick(checkpoint.redoStrokeIds),
    nextSequence: checkpoint.nextSequence,
    finished: checkpoint.finished,
  };
}
