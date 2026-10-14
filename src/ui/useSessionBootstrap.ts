/** Open storage before the child chooses a lesson. */

import { useEffect, useState } from 'react';
import { createSessionStore } from '../persistence';
import type { SessionStore } from '../persistence/types';

export type Bootstrap =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly store: SessionStore;
      readonly durable: boolean;
    }
  | { readonly status: 'error'; readonly message: string };

export function useSessionBootstrap(): Bootstrap {
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { store, durable } = await createSessionStore();
        if (cancelled) {
          store.close();
          return;
        }
        setBootstrap({ status: 'ready', store, durable });
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
