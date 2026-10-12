/**
 * Persistence round trip (FR-13, AT-05).
 *
 * Runs against the real `IndexedDbSessionStore` on `fake-indexeddb`, so the
 * transactions, key ranges and index lookups are the ones the browser will run.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { reduceSession } from '../lesson-engine/session';
import type { SessionState } from '../lesson-engine/types';
import { IndexedDbSessionStore } from './indexeddb-store';
import { MemorySessionStore } from './memory-store';
import { IncompatibleCheckpointError, fromRestoredSession, toCheckpoint } from './mapping';
import { PERSISTENCE_SCHEMA_VERSION, type SessionStore } from './types';
import { applyAll, draw, lesson, newSessionState, stepIdAt } from '../test/factories';

async function save(store: SessionStore, state: SessionState, revision: number): Promise<void> {
  await store.saveProgress({
    checkpoint: toCheckpoint(state, revision, Date.now() + revision),
    newStrokes: [...state.strokes, ...state.redoStack],
  });
}

describe.each([
  ['IndexedDbSessionStore', () => new IndexedDbSessionStore(new IDBFactory())],
  ['MemorySessionStore', () => new MemorySessionStore()],
])('%s round trip', (_name, makeStore) => {
  let store: SessionStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('restores step, assistance, tools and committed strokes (AT-05)', async () => {
    const state = applyAll(draw(draw(newSessionState(), stepIdAt(0)), stepIdAt(0)), [
      { type: 'next-step' },
      { type: 'set-assistance-mode', mode: 'temporary' },
      { type: 'set-hint-duration', ms: 10000 },
      { type: 'set-input-mode', mode: 'pencil' },
      { type: 'set-custom-color', color: '#4a9b5c' },
    ]);
    const withLater = draw(state, stepIdAt(1));

    await save(store, withLater, 1);

    const restored = await store.loadSession(withLater.sessionId);
    expect(restored).not.toBeNull();
    const reopened = fromRestoredSession(restored!);

    expect(reopened).toEqual(withLater);
  });

  it('keeps an undone stroke out of the artwork but available to redo', async () => {
    const drawn = draw(draw(newSessionState(), stepIdAt(0)), stepIdAt(0));
    const undone = reduceSession(lesson, drawn, { type: 'undo' });

    await save(store, undone, 1);
    const reopened = fromRestoredSession((await store.loadSession(undone.sessionId))!);

    expect(reopened.strokes).toHaveLength(1);
    expect(reopened.redoStack).toHaveLength(1);

    const redone = reduceSession(lesson, reopened, { type: 'redo' });
    expect(redone.strokes).toHaveLength(2);
  });

  it('appends later strokes to the same session without rewriting the log', async () => {
    const first = draw(newSessionState(), stepIdAt(0));
    await save(store, first, 1);

    const second = draw(first, stepIdAt(0));
    await store.saveProgress({
      checkpoint: toCheckpoint(second, 2, Date.now() + 2),
      newStrokes: [second.strokes[1]!],
    });

    const reopened = fromRestoredSession((await store.loadSession(second.sessionId))!);
    expect(reopened.strokes.map((stroke) => stroke.id)).toEqual(
      second.strokes.map((stroke) => stroke.id),
    );
  });

  it('returns the most recently updated session for "lanjutkan karya"', async () => {
    const older: SessionState = { ...draw(newSessionState(), stepIdAt(0)), sessionId: 'older' };
    const newer: SessionState = { ...draw(newSessionState(), stepIdAt(0)), sessionId: 'newer' };
    await save(store, older, 1);
    await save(store, newer, 2);

    const latest = await store.loadLatestSession();
    expect(latest?.checkpoint.sessionId).toBe('newer');
  });

  it('keeps sessions apart and deletes only the one asked for', async () => {
    const a: SessionState = { ...draw(newSessionState(), stepIdAt(0)), sessionId: 'a' };
    const b: SessionState = { ...draw(newSessionState(), stepIdAt(0)), sessionId: 'b' };
    await save(store, a, 1);
    await save(store, b, 2);

    await store.deleteSession('a');
    expect(await store.loadSession('a')).toBeNull();

    const remaining = await store.loadSession('b');
    expect(remaining?.strokes).toHaveLength(1);
  });

  it('round trips preferences separately from the session', async () => {
    const state = applyAll(newSessionState(), [
      { type: 'set-input-mode', mode: 'pencil' },
      { type: 'set-custom-color', color: '#f2d14b' },
    ]);
    const preferences = {
      assistanceMode: state.assistanceMode,
      hintDurationMs: state.hintDurationMs,
      inputMode: state.inputMode,
      toolPreferences: state.toolPreferences,
    };

    expect(await store.loadPreferences()).toBeNull();
    await store.savePreferences(preferences);
    expect(await store.loadPreferences()).toEqual(preferences);
  });

  it('reports no session when nothing was ever saved', async () => {
    expect(await store.loadLatestSession()).toBeNull();
    expect(await store.loadSession('never-saved')).toBeNull();
  });
});

describe('checkpoint integrity', () => {
  it('refuses a checkpoint whose stroke log is incomplete', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const checkpoint = toCheckpoint(drawn, 1, Date.now());

    expect(() => fromRestoredSession({ checkpoint, strokes: [] })).toThrow(
      IncompatibleCheckpointError,
    );
  });

  it('refuses a checkpoint written by a newer schema version (FR-25)', () => {
    const drawn = draw(newSessionState(), stepIdAt(0));
    const checkpoint = {
      ...toCheckpoint(drawn, 1, Date.now()),
      schemaVersion: PERSISTENCE_SCHEMA_VERSION + 1,
    };

    expect(() => fromRestoredSession({ checkpoint, strokes: [...drawn.strokes] })).toThrow(
      IncompatibleCheckpointError,
    );
  });
});

describe('IndexedDB specifics', () => {
  it('writes strokes and the checkpoint in one transaction', async () => {
    // A rolled-back transaction must leave nothing behind, so a crash mid-save
    // cannot produce a checkpoint that names strokes the log does not have
    // (FR-13, AT-14).
    const store = new IndexedDbSessionStore(new IDBFactory());
    const drawn = draw(newSessionState(), stepIdAt(0));

    await expect(
      store.saveProgress({
        checkpoint: toCheckpoint(drawn, 1, Date.now()),
        // A structured-clone-hostile value aborts the transaction.
        newStrokes: [{ ...drawn.strokes[0]!, points: [{ x: 0, y: () => 0 } as never] }],
      }),
    ).rejects.toThrow();

    expect(await store.loadSession(drawn.sessionId)).toBeNull();
  });

  it('accepts re-saving a stroke that is already in the log', async () => {
    const store = new IndexedDbSessionStore(new IDBFactory());
    const drawn = draw(newSessionState(), stepIdAt(0));

    await save(store, drawn, 1);
    await save(store, drawn, 2);

    const reopened = fromRestoredSession((await store.loadSession(drawn.sessionId))!);
    expect(reopened.strokes).toHaveLength(1);
  });
});
