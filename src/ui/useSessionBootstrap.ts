/** Validate the bundled lessons and open storage before the child chooses one. */

import { useEffect, useState } from 'react';
import { BUNDLED_LESSONS, assertValidLessons } from '../lesson-data';
import { createSessionStore } from '../persistence';
import type { SessionStore } from '../persistence/types';

export type Bootstrap =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly store: SessionStore;
      readonly durable: boolean;
    }
  | { readonly status: 'error' };

export function useSessionBootstrap(): Bootstrap {
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        assertValidLessons(BUNDLED_LESSONS);
        const { store, durable } = await createSessionStore();
        if (cancelled) {
          store.close();
          return;
        }
        setBootstrap({ status: 'ready', store, durable });
      } catch (error) {
        if (!cancelled) {
          console.error('DrawSprout could not start:', error);
          setBootstrap({ status: 'error' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return bootstrap;
}
