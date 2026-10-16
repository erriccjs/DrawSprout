/**
 * In-memory `SessionStore`.
 *
 * Used by tests that care about engine or UI behaviour rather than the database,
 * and as the fallback when IndexedDB is unavailable (private mode on some
 * browsers). The fallback is deliberately not durable: it keeps a session usable
 * for its duration instead of pretending the work is saved.
 */

import type { SessionPreferences, Stroke } from '../lesson-engine/types';
import type {
  RestoredSession,
  SaveProgressInput,
  SessionCheckpoint,
  SessionStore,
} from './types';

export class MemorySessionStore implements SessionStore {
  private readonly checkpoints = new Map<string, SessionCheckpoint>();
  private readonly strokes = new Map<string, Map<string, Stroke>>();
  private preferences: SessionPreferences | null = null;

  saveProgress({ checkpoint, newStrokes }: SaveProgressInput): Promise<void> {
    if (checkpoint.committedStrokeIds.length === 0 && checkpoint.redoStrokeIds.length === 0) {
      for (const saved of this.checkpoints.values()) {
        if (saved.lessonId === checkpoint.lessonId &&
            (saved.committedStrokeIds.length > 0 || saved.redoStrokeIds.length > 0)) {
          return Promise.resolve();
        }
      }
    }
    const log = this.strokes.get(checkpoint.sessionId) ?? new Map<string, Stroke>();
    for (const stroke of newStrokes) log.set(stroke.id, stroke);
    this.strokes.set(checkpoint.sessionId, log);
    this.checkpoints.set(checkpoint.sessionId, checkpoint);
    return Promise.resolve();
  }

  loadSession(sessionId: string): Promise<RestoredSession | null> {
    const checkpoint = this.checkpoints.get(sessionId);
    if (!checkpoint) return Promise.resolve(null);
    const log = this.strokes.get(sessionId);
    return Promise.resolve({
      checkpoint,
      strokes: log ? [...log.values()] : [],
    });
  }

  loadLatestSession(): Promise<RestoredSession | null> {
    let latest: SessionCheckpoint | null = null;
    for (const checkpoint of this.checkpoints.values()) {
      if (!latest || checkpoint.updatedAt >= latest.updatedAt) latest = checkpoint;
    }
    return latest === null ? Promise.resolve(null) : this.loadSession(latest.sessionId);
  }

  loadLatestSessionForLesson(lessonId: string): Promise<RestoredSession | null> {
    let latest: SessionCheckpoint | null = null;
    for (const checkpoint of this.checkpoints.values()) {
      if (checkpoint.lessonId === lessonId && (!latest || checkpoint.updatedAt >= latest.updatedAt)) {
        latest = checkpoint;
      }
    }
    return latest === null ? Promise.resolve(null) : this.loadSession(latest.sessionId);
  }

  deleteSession(sessionId: string): Promise<void> {
    this.checkpoints.delete(sessionId);
    this.strokes.delete(sessionId);
    return Promise.resolve();
  }

  loadPreferences(): Promise<SessionPreferences | null> {
    return Promise.resolve(this.preferences);
  }

  savePreferences(preferences: SessionPreferences): Promise<void> {
    this.preferences = preferences;
    return Promise.resolve();
  }

  close(): void {
    /* nothing to release */
  }
}
