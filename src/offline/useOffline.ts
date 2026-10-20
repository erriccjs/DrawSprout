/**
 * Subscribes the page to offline status.
 *
 * Production builds register the worker. Tests and the dev server do not, but
 * they still observe the same status store, so a waiting update can be rendered
 * without a browser that implements service workers.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { BUNDLED_LESSONS } from '../lesson-data';
import { registerOffline, shouldRegisterServiceWorker, type RegisteredOffline } from './register';
import {
  getOfflineSnapshot,
  markOfflineReady,
  markUpdateWaiting,
  requestOfflineApply,
  subscribeOffline,
  type OfflineSnapshot,
} from './status';

export interface OfflineStatus extends OfflineSnapshot {
  requestApply(this: void): void;
  applyUpdate(this: void): void;
}

export function useOfflineSupport(options?: { readonly production?: boolean }): OfflineStatus {
  const snapshot = useSyncExternalStore(subscribeOffline, getOfflineSnapshot, getOfflineSnapshot);
  const registrationRef = useRef<RegisteredOffline | null>(null);
  const production = options?.production ?? import.meta.env.PROD;

  useEffect(() => {
    const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    if (!shouldRegisterServiceWorker({ production, supported })) return;

    const registered = registerOffline(navigator.serviceWorker, {
      requiredLessons: BUNDLED_LESSONS.map((lesson) => ({
        id: lesson.id,
        contentVersion: lesson.contentVersion,
      })),
      onReady: markOfflineReady,
      onWaiting: markUpdateWaiting,
      reload: () => {
        window.location.reload();
      },
    });
    registrationRef.current = registered;

    const onVisible = () => {
      if (document.visibilityState === 'visible') void registered.checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      registered.dispose();
      registrationRef.current = null;
    };
  }, [production]);

  const requestApply = useCallback(function requestApply(this: void) {
    requestOfflineApply();
  }, []);

  const applyUpdate = useCallback(function applyUpdate(this: void) {
    registrationRef.current?.applyUpdate();
  }, []);

  return {
    ready: snapshot.ready,
    updateWaiting: snapshot.updateWaiting,
    applyRequested: snapshot.applyRequested,
    requestApply,
    applyUpdate,
  };
}
