import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CAT_LESSON } from '../lesson-data';
import { createSession, reduceSession } from '../lesson-engine/session';
import { toCheckpoint } from '../persistence/mapping';
import { MemorySessionStore } from '../persistence/memory-store';
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
});
