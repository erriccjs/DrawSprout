/**
 * Autosave.
 *
 * FR-13 and PRD section 13 ask for two different cadences: a finished stroke is
 * committed straight away, while everything else (step, tool, mode) is
 * checkpointed no more often than every two seconds. Both go into the same
 * transaction, so a checkpoint can never describe strokes that were not written.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionState } from '../lesson-engine/types';
import { toCheckpoint } from '../persistence/mapping';
import { StorageFullError, type SessionStore } from '../persistence/types';

export const CHECKPOINT_INTERVAL_MS = 2000;

export type SaveStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: number }
  | { readonly kind: 'storage-full' }
  | { readonly kind: 'failed'; readonly message: string };

export function useAutosave(
  store: SessionStore,
  state: SessionState,
): { status: SaveStatus; flush: () => Promise<boolean> } {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  // Written in an effect rather than during render; the save effect below is
  // declared after this one, so it always reads the committed state.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const revisionRef = useRef(0);
  const savedStrokeIdsRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  const flush = useCallback(async (): Promise<boolean> => {
    // Serialise saves: two overlapping transactions could otherwise land in the
    // wrong order and leave an older checkpoint on top.
    await inFlightRef.current;

    const current = stateRef.current;
    revisionRef.current += 1;
    const checkpoint = toCheckpoint(current, revisionRef.current, Date.now());
    // The redo stack is persisted too, so a stroke that is currently undone
    // still has to be in the log for redo to work after a reload.
    const newStrokes = [...current.strokes, ...current.redoStack].filter(
      (stroke) => !savedStrokeIdsRef.current.has(stroke.id),
    );

    setStatus({ kind: 'saving' });
    const save = store
      .saveProgress({ checkpoint, newStrokes })
      .then(() => {
        for (const stroke of newStrokes) savedStrokeIdsRef.current.add(stroke.id);
        setStatus({ kind: 'saved', at: Date.now() });
        return true;
      })
      .catch((error: unknown) => {
        if (error instanceof StorageFullError) setStatus({ kind: 'storage-full' });
        else setStatus({ kind: 'failed', message: describe(error) });
        return false;
      });

    inFlightRef.current = save;
    return await save;
  }, [store]);

  useEffect(() => {
    const hasUnsavedStroke = [...state.strokes, ...state.redoStack].some(
      (stroke) => !savedStrokeIdsRef.current.has(stroke.id),
    );

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, hasUnsavedStroke ? 0 : CHECKPOINT_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [state, flush]);

  useEffect(() => {
    // Best effort only: PRD section 13 says not to rely on `beforeunload` or on
    // anything running after the page is hidden.
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  return { status, flush };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
