/** Open storage and preferences before the child chooses a lesson. */

import { useEffect, useState } from 'react';
import { DEFAULT_PREFERENCES } from '../lesson-engine/session';
import type { SessionPreferences } from '../lesson-engine/types';
import { createSessionStore } from '../persistence';
import type { SessionStore } from '../persistence/types';

export type Bootstrap =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly store: SessionStore;
      readonly durable: boolean;
      readonly preferences: SessionPreferences;
    }
  | { readonly status: 'error'; readonly message: string };

export function useSessionBootstrap(): Bootstrap {
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { store, durable } = await createSessionStore();
        const preferences = (await store.loadPreferences()) ?? DEFAULT_PREFERENCES;
        if (cancelled) {
          store.close();
          return;
        }
        setBootstrap({ status: 'ready', store, durable, preferences });
      } catch (error) {
        if (!cancelled) {
          setBootstrap({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return bootstrap;
}
