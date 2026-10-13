/**
 * Startup: open storage, then resume the last session or begin a new one.
 *
 * Resume is what AT-05 asks for; everything here is about deciding whether the
 * stored session can still be trusted, and saying so plainly when it cannot.
 */

import { useEffect, useState } from 'react';
import { CAT_LESSON, assertValidLesson } from '../lesson-data';
import type { LessonPackage } from '../lesson-data/schema';
import { DEFAULT_PREFERENCES, createSession } from '../lesson-engine/session';
import type { SessionState } from '../lesson-engine/types';
import { createSessionStore } from '../persistence';
import { fromRestoredSession } from '../persistence/mapping';
import type { SessionStore } from '../persistence/types';
import { newId } from './ids';

export type Bootstrap =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly lesson: LessonPackage;
      readonly store: SessionStore;
      /** `false` when the work will not survive a reload. */
      readonly durable: boolean;
      readonly initialState: SessionState;
      readonly resumed: boolean;
      /** Set when a stored session existed but could not be reopened. */
      readonly resumeProblem: string | null;
    }
  | { readonly status: 'error'; readonly message: string };

export function useSessionBootstrap(): Bootstrap {
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const lesson = assertValidLesson(CAT_LESSON);
        const { store, durable } = await createSessionStore();
        const preferences = (await store.loadPreferences()) ?? DEFAULT_PREFERENCES;
        const restored = await store.loadLatestSession();

        let initialState = createSession(lesson, newId(), preferences);
        let resumed = false;
        let resumeProblem: string | null = null;

        if (restored) {
          if (restored.checkpoint.lessonId !== lesson.id) {
            resumeProblem = 'Karya tersimpan berasal dari pelajaran lain yang belum tersedia.';
          } else if (restored.checkpoint.lessonContentVersion !== lesson.contentVersion) {
            // The geometry may have moved, so the old strokes would no longer
            // line up with the guides. Milestone 1 starts fresh and says so;
            // migrating old lesson versions is FR-25 work.
            resumeProblem = 'Pelajaran sudah diperbarui, jadi karya lama dibuka sebagai karya baru.';
          } else {
            try {
              initialState = fromRestoredSession(restored);
              resumed = true;
            } catch (error) {
              resumeProblem = `Karya tersimpan tidak dapat dibuka: ${describe(error)}`;
            }
          }
        }

        if (cancelled) {
          store.close();
          return;
        }
        setBootstrap({
          status: 'ready',
          lesson,
          store,
          durable,
          initialState,
          resumed,
          resumeProblem,
        });
      } catch (error) {
        if (!cancelled) setBootstrap({ status: 'error', message: describe(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return bootstrap;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
