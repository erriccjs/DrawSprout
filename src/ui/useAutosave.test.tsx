import { act, renderHook } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CAT_LESSON } from '../lesson-data';
import { createSession, reduceSession } from '../lesson-engine/session';
import { toCheckpoint } from '../persistence/mapping';
import { IndexedDbSessionStore } from '../persistence/indexeddb-store';
import { MemorySessionStore } from '../persistence/memory-store';
import type { SessionStore } from '../persistence/types';
import { strokeInput } from '../test/factories';
import { useAutosave } from './useAutosave';

describe('useAutosave', () => {
  it('does not save an empty session over a stored drawing', async () => {
    const store = new MemorySessionStore();
    const saved = reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'saved'), {
      type: 'commit-stroke', stroke: strokeInput(CAT_LESSON.steps[0]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes });
    const { result } = renderHook(() => useAutosave(store, createSession(CAT_LESSON, 'empty'), false));

    await act(async () => { expect(await result.current.flush()).toBe(true); });

    const latest = await store.loadLatestSessionForLesson(CAT_LESSON.id);
    expect(latest?.checkpoint.sessionId).toBe('saved');
    expect(latest?.checkpoint.committedStrokeIds).toEqual([saved.strokes[0]!.id]);
  });

  it.each([
    ['IndexedDB', () => new IndexedDbSessionStore(new IDBFactory())],
    ['memory', () => new MemorySessionStore()],
  ])('does not report a skipped save as saved in %s', async (_name, makeStore: () => SessionStore) => {
    const store = makeStore();
    const saved = reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'saved'), {
      type: 'commit-stroke', stroke: strokeInput(CAT_LESSON.steps[0]!.id),
    });
    expect(await store.saveProgress({ checkpoint: toCheckpoint(saved, 1, 123), newStrokes: saved.strokes })).toBe(true);
    const empty = createSession(CAT_LESSON, 'empty');
    const { result } = renderHook(() => useAutosave(store, empty, false));

    await act(async () => { expect(await result.current.flush()).toBe(true); });

    expect(result.current.status).toEqual({ kind: 'idle' });
    expect(await store.loadSession(empty.sessionId)).toBeNull();
  });

  it.each([
    ['IndexedDB', () => new IndexedDbSessionStore(new IDBFactory())],
    ['memory', () => new MemorySessionStore()],
  ])('stops reading as saved once a clear is skipped in %s', async (_name, makeStore: () => SessionStore) => {
    const store = makeStore();
    const drawn = reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'drawn'), {
      type: 'commit-stroke', stroke: strokeInput(CAT_LESSON.steps[0]!.id),
    });
    const { result, rerender } = renderHook(({ state }) => useAutosave(store, state, false), {
      initialProps: { state: drawn },
    });
    await act(async () => { expect(await result.current.flush()).toBe(true); });
    expect(result.current.status.kind).toBe('saved');

    rerender({ state: reduceSession(CAT_LESSON, drawn, { type: 'clear-all' }) });
    await act(async () => { expect(await result.current.flush()).toBe(true); });

    expect(result.current.status).toEqual({ kind: 'idle' });
    const stored = await store.loadSession('drawn');
    expect(stored?.checkpoint.committedStrokeIds).toEqual([drawn.strokes[0]!.id]);
  });

  it.each([
    ['IndexedDB', () => new IndexedDbSessionStore(new IDBFactory())],
    ['memory', () => new MemorySessionStore()],
  ])('does not restore a deleted session status after restart in %s', async (_name, makeStore: () => SessionStore) => {
    const store = makeStore();
    const current = createSession(CAT_LESSON, 'current');
    const { result } = renderHook(() => useAutosave(store, current, false));
    await act(async () => { expect(await result.current.flush()).toBe(true); });
    expect(result.current.status.kind).toBe('saved');

    const drawn = reduceSession(CAT_LESSON, createSession(CAT_LESSON, 'drawn'), {
      type: 'commit-stroke', stroke: strokeInput(CAT_LESSON.steps[0]!.id),
    });
    await store.saveProgress({ checkpoint: toCheckpoint(drawn, 1, Date.now() + 1), newStrokes: drawn.strokes });
    await act(async () => { await result.current.clearSession(createSession(CAT_LESSON, 'fresh')); });
    await act(async () => { expect(await result.current.flush()).toBe(true); });

    expect(result.current.status).toEqual({ kind: 'idle' });
    expect(await store.loadSession(current.sessionId)).toBeNull();
    expect(await store.loadSession('fresh')).toBeNull();
  });
});
