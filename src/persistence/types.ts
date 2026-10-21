/**
 * The persistence boundary.
 *
 * Nothing in this file mentions IndexedDB. The engine and the UI depend on
 * `SessionStore` only, so the IndexedDB implementation can be swapped for an
 * in-memory one in tests or for native storage later (PRD section 11:
 * storage is kept separate from the lesson engine).
 */

import type { SessionPreferences, SessionState, Stroke } from '../lesson-engine/types';

/** Bumped when the stored shapes change incompatibly (FR-25). */
export const PERSISTENCE_SCHEMA_VERSION = 1;

/**
 * Everything about a session except the strokes themselves.
 *
 * Strokes live in an append-only log so a finished stroke is durable the moment
 * it is drawn, while the checkpoint records which of them were committed and
 * which were undone (FR-13). Restoring is therefore "replay the log in the
 * order the checkpoint remembers", with no way for an undone stroke to come
 * back as artwork.
 */
export interface SessionCheckpoint {
  readonly schemaVersion: number;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly lessonContentVersion: string;
  /** Increments on every saved checkpoint. */
  readonly revision: number;
  readonly updatedAt: number;
  readonly currentStepIndex: number;
  readonly assistanceMode: SessionState['assistanceMode'];
  readonly hintDurationMs: SessionState['hintDurationMs'];
  readonly inputMode: SessionState['inputMode'];
  readonly toolPreferences: SessionState['toolPreferences'];
  readonly nextSequence: number;
  readonly finished: boolean;
  /** Stroke ids in replay order. */
  readonly committedStrokeIds: readonly string[];
  /** Undone stroke ids, oldest undo first, so redo survives a reload (AT-05). */
  readonly redoStrokeIds: readonly string[];
}

export interface RestoredSession {
  readonly checkpoint: SessionCheckpoint;
  /** Every stroke in the log, including ones the checkpoint has undone. */
  readonly strokes: readonly Stroke[];
}

/** What the gallery needs without reading the stroke log. */
export interface SavedArtworkSummary {
  readonly sessionId: string;
  readonly lessonId: string;
  readonly updatedAt: number;
  readonly finished: boolean;
  readonly currentStepIndex: number;
}

/**
 * A checkpoint a child would recognise as their own picture.
 * Opening a lesson and leaving before any mark does not count.
 */
export function isGalleryArtwork(checkpoint: SessionCheckpoint): boolean {
  return (
    checkpoint.finished ||
    checkpoint.currentStepIndex > 0 ||
    checkpoint.committedStrokeIds.length > 0 ||
    checkpoint.redoStrokeIds.length > 0
  );
}

export function toSavedArtworkSummary(checkpoint: SessionCheckpoint): SavedArtworkSummary {
  return {
    sessionId: checkpoint.sessionId,
    lessonId: checkpoint.lessonId,
    updatedAt: checkpoint.updatedAt,
    finished: checkpoint.finished,
    currentStepIndex: checkpoint.currentStepIndex,
  };
}

export interface SaveProgressInput {
  readonly checkpoint: SessionCheckpoint;
  /** Strokes not yet written to the log. */
  readonly newStrokes: readonly Stroke[];
}

export interface SessionStore {
  /**
   * Writes the new strokes and checkpoint together. IndexedDB uses one
   * transaction so a failure leaves the previous valid checkpoint untouched
   * (FR-13, AT-14). Returns false without writing when an empty session would
   * replace a drawing in the lesson.
   */
  saveProgress(input: SaveProgressInput): Promise<boolean>;
  loadSession(sessionId: string): Promise<RestoredSession | null>;
  /** Most recently updated session, for the "lanjutkan karya" entry point. */
  loadLatestSession(): Promise<RestoredSession | null>;
  /** Most recently updated session belonging to one lesson. */
  loadLatestSessionForLesson(lessonId: string): Promise<RestoredSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  /**
   * Saved artworks for the picture-choosing screen, newest first.
   * An untouched session (no strokes, still on step 1, not finished) is omitted.
   */
  listSavedArtworks(): Promise<readonly SavedArtworkSummary[]>;
  loadPreferences(): Promise<SessionPreferences | null>;
  savePreferences(preferences: SessionPreferences): Promise<void>;
  close(): void;
}

/**
 * Thrown when the browser refuses a write because storage is full. Kept as its
 * own type so the UI can offer to free space instead of showing a generic
 * failure (AT-14).
 */
export class StorageFullError extends Error {
  constructor(cause?: unknown) {
    super('Penyimpanan perangkat penuh, karya terakhir belum tersimpan.');
    this.name = 'StorageFullError';
    this.cause = cause;
  }
}
