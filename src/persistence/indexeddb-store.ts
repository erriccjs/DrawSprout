/**
 * IndexedDB implementation of `SessionStore`.
 *
 * FR-13 requires finished strokes and checkpoints to be written through
 * IndexedDB transactions, and PRD section 11 forbids keeping drawing data in
 * localStorage. This is the only file in the project that knows IndexedDB
 * exists for session data. Photo lessons use a separate database so this
 * version stays 1.
 */

import type { SessionPreferences, Stroke } from '../lesson-engine/types';
import {
  isGalleryArtwork,
  StorageFullError,
  toSavedArtworkSummary,
  type RestoredSession,
  type SaveProgressInput,
  type SavedArtworkSummary,
  type SessionCheckpoint,
  type SessionStore,
} from './types';

const DB_NAME = 'drawsprout';
const DB_VERSION = 1;

const CHECKPOINTS = 'checkpoints';
const STROKES = 'strokes';
const PREFERENCES = 'preferences';

const PREFERENCES_KEY = 'default';

/** Row shape in the stroke log. The compound key keeps sessions apart. */
interface StrokeRow {
  readonly sessionId: string;
  readonly strokeId: string;
  readonly stroke: Stroke;
}

export function openDatabase(indexedDb: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHECKPOINTS)) {
        const store = db.createObjectStore(CHECKPOINTS, { keyPath: 'sessionId' });
        store.createIndex('byUpdatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(STROKES)) {
        db.createObjectStore(STROKES, { keyPath: ['sessionId', 'strokeId'] });
      }
      if (!db.objectStoreNames.contains(PREFERENCES)) {
        db.createObjectStore(PREFERENCES);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
    request.onblocked = () =>
      reject(new Error('IndexedDB upgrade is blocked by another open tab'));
  });
}

export class IndexedDbSessionStore implements SessionStore {
  private readonly dbPromise: Promise<IDBDatabase>;
  private db: IDBDatabase | null = null;

  constructor(indexedDb: IDBFactory = indexedDB) {
    this.dbPromise = openDatabase(indexedDb).then((db) => {
      this.db = db;
      return db;
    });
  }

  async saveProgress({ checkpoint, newStrokes }: SaveProgressInput): Promise<boolean> {
    const db = await this.dbPromise;
    return await runTransaction(db, [STROKES, CHECKPOINTS], 'readwrite', async (tx) => {
      const checkpoints = tx.objectStore(CHECKPOINTS);
      if (checkpoint.committedStrokeIds.length === 0 && checkpoint.redoStrokeIds.length === 0) {
        const existing = await request<SessionCheckpoint[]>(checkpoints.getAll());
        if (existing.some((saved) =>
          saved.lessonId === checkpoint.lessonId &&
          (saved.committedStrokeIds.length > 0 || saved.redoStrokeIds.length > 0)
        )) return false;
      }
      const strokes = tx.objectStore(STROKES);
      for (const stroke of newStrokes) {
        const row: StrokeRow = {
          sessionId: checkpoint.sessionId,
          strokeId: stroke.id,
          stroke,
        };
        // `put` rather than `add`: re-saving the same stroke after a retry must
        // not abort the transaction and lose the checkpoint with it.
        strokes.put(row);
      }
      checkpoints.put(checkpoint);
      return true;
    });
  }

  async loadSession(sessionId: string): Promise<RestoredSession | null> {
    const db = await this.dbPromise;
    return await runTransaction(db, [CHECKPOINTS, STROKES], 'readonly', async (tx) => {
      // Both requests are issued before the first await. A transaction
      // auto-commits once the event loop drains with nothing pending, so
      // awaiting between two requests would make the second one fail.
      const checkpointRequest = tx.objectStore(CHECKPOINTS).get(sessionId);
      const strokesRequest = tx.objectStore(STROKES).getAll(sessionRange(sessionId));

      const checkpoint = await request<SessionCheckpoint | undefined>(checkpointRequest);
      if (!checkpoint) return null;
      const rows = await request<StrokeRow[]>(strokesRequest);
      return { checkpoint, strokes: rows.map((row) => row.stroke) };
    });
  }

  async loadLatestSession(): Promise<RestoredSession | null> {
    const db = await this.dbPromise;
    const sessionId = await runTransaction(db, [CHECKPOINTS], 'readonly', async (tx) => {
      const cursor = await request<IDBCursorWithValue | null>(
        tx.objectStore(CHECKPOINTS).index('byUpdatedAt').openCursor(null, 'prev'),
      );
      return cursor ? (cursor.value as SessionCheckpoint).sessionId : null;
    });
    return sessionId === null ? null : await this.loadSession(sessionId);
  }

  async loadLatestSessionForLesson(lessonId: string): Promise<RestoredSession | null> {
    const db = await this.dbPromise;
    const sessionId = await runTransaction(db, [CHECKPOINTS], 'readonly', async (tx) => {
      const checkpoints = await request<SessionCheckpoint[]>(tx.objectStore(CHECKPOINTS).getAll());
      const latest = checkpoints
        .filter((checkpoint) => checkpoint.lessonId === lessonId)
        .reduce<SessionCheckpoint | null>(
          (current, checkpoint) =>
            !current || checkpoint.updatedAt >= current.updatedAt ? checkpoint : current,
          null,
        );
      return latest?.sessionId ?? null;
    });
    return sessionId === null ? null : await this.loadSession(sessionId);
  }

  async listSavedArtworks(): Promise<readonly SavedArtworkSummary[]> {
    const db = await this.dbPromise;
    const checkpoints = await runTransaction(db, [CHECKPOINTS], 'readonly', async (tx) =>
      request<SessionCheckpoint[]>(tx.objectStore(CHECKPOINTS).getAll()),
    );
    return checkpoints
      .filter(isGalleryArtwork)
      .sort((a, b) => b.updatedAt - a.updatedAt || (a.sessionId < b.sessionId ? 1 : -1))
      .map(toSavedArtworkSummary);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.dbPromise;
    await runTransaction(db, [CHECKPOINTS, STROKES], 'readwrite', (tx) => {
      tx.objectStore(CHECKPOINTS).delete(sessionId);
      tx.objectStore(STROKES).delete(sessionRange(sessionId));
    });
  }

  async deleteSessionsForLesson(lessonId: string): Promise<void> {
    const db = await this.dbPromise;
    const checkpoints = await runTransaction(db, [CHECKPOINTS], 'readonly', async (tx) =>
      request<SessionCheckpoint[]>(tx.objectStore(CHECKPOINTS).getAll()),
    );
    const ids = checkpoints.filter((checkpoint) => checkpoint.lessonId === lessonId).map((checkpoint) => checkpoint.sessionId);
    if (ids.length === 0) return;
    await runTransaction(db, [CHECKPOINTS, STROKES], 'readwrite', (tx) => {
      for (const id of ids) {
        tx.objectStore(CHECKPOINTS).delete(id);
        tx.objectStore(STROKES).delete(sessionRange(id));
      }
    });
  }

  async loadPreferences(): Promise<SessionPreferences | null> {
    const db = await this.dbPromise;
    return await runTransaction(db, [PREFERENCES], 'readonly', async (tx) => {
      const stored = await request<SessionPreferences | undefined>(
        tx.objectStore(PREFERENCES).get(PREFERENCES_KEY),
      );
      return stored ?? null;
    });
  }

  async savePreferences(preferences: SessionPreferences): Promise<void> {
    const db = await this.dbPromise;
    await runTransaction(db, [PREFERENCES], 'readwrite', (tx) => {
      tx.objectStore(PREFERENCES).put(preferences, PREFERENCES_KEY);
    });
  }

  close(): void {
    this.db?.close();
  }
}

/** Every key belonging to one session in the compound-key stroke log. */
function sessionRange(sessionId: string): IDBKeyRange {
  return IDBKeyRange.bound([sessionId, ''], [sessionId, '￿']);
}

function request<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/**
 * Runs `work` inside one transaction and settles when the transaction itself
 * completes, not when the last request succeeds. Waiting for `oncomplete` is
 * what makes "the stroke is saved" mean the bytes are durable.
 */
async function runTransaction<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const tx = db.transaction(stores, mode);
  const completion = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(toStoreError(tx.error));
    tx.onerror = () => reject(toStoreError(tx.error));
  });
  // When `work` throws before anything awaits `completion`, the abort below
  // still rejects it. Marking it handled here keeps that from surfacing as an
  // unhandled rejection; `await completion` further down still throws.
  completion.catch(() => undefined);

  let result: T;
  try {
    result = await work(tx);
  } catch (error) {
    // The transaction may already have committed or aborted on its own.
    try {
      tx.abort();
    } catch {
      /* nothing left to abort */
    }
    throw error;
  }
  await completion;
  return result;
}

function toStoreError(error: DOMException | null): Error {
  if (error?.name === 'QuotaExceededError') return new StorageFullError(error);
  return error ?? new Error('IndexedDB transaction failed');
}

/**
 * Asks the browser to exempt our data from routine eviction. Best effort by
 * design: PRD section 13 says not to assume the permission is granted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || typeof navigator.storage?.persist !== 'function') return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
