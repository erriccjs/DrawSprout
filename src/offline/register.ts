/**
 * Registers the production service worker and applies an update only when
 * asked.
 *
 * The dev server does not register a worker: a cached shell there would hide
 * the edit that was just saved. `npm run preview` is the local way to exercise
 * the worker. A failed update check (the usual case when the radio is off) is
 * not a failed registration — the worker already in control keeps serving.
 */

import { lessonsAreCovered, type PrecacheLesson } from './precache';
import { GET_STATUS, SKIP_WAITING, parseWorkerMessage } from './messages';

export function shouldRegisterServiceWorker(env: {
  readonly production: boolean;
  readonly supported: boolean;
}): boolean {
  return env.production && env.supported;
}

export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

export interface RegistrationLike {
  active: WorkerLike | null;
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  update(): Promise<unknown>;
  addEventListener(type: 'updatefound', listener: () => void): void;
  removeEventListener(type: 'updatefound', listener: () => void): void;
}

export interface WorkerContainerLike {
  readonly controller: WorkerLike | null;
  register(
    scriptUrl: string,
    options: { scope: string; updateViaCache: 'none' },
  ): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'controllerchange', listener: () => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export interface RegisterOfflineOptions {
  readonly scriptUrl?: string;
  readonly requiredLessons: readonly PrecacheLesson[];
  /** Called only after the worker's lesson list covers `requiredLessons`. */
  readonly onReady: () => void;
  readonly onWaiting: () => void;
  readonly reload: () => void;
}

export interface RegisteredOffline {
  /** Ask the waiting worker to take over. The page reloads after it does. */
  applyUpdate(): void;
  checkForUpdate(): Promise<void>;
  /** Resolves once the first `register()` attempt has settled. */
  readonly settled: Promise<void>;
  dispose(): void;
}

export function registerOffline(
  container: WorkerContainerLike,
  options: RegisterOfflineOptions,
): RegisteredOffline {
  const scriptUrl = options.scriptUrl ?? '/sw.js';
  let registration: RegistrationLike | null = null;
  let applyRequested = false;
  let disposed = false;
  let reloaded = false;
  const watched = new Set<WorkerLike>();
  const cleanups: (() => void)[] = [];

  let resolveSettled: () => void = () => {};
  const settled = new Promise<void>((resolve) => {
    resolveSettled = resolve;
  });

  const onControllerChange = () => {
    // The first install also changes the controller when it claims the page.
    // That must not reload: the page is already running this version.
    if (!applyRequested || reloaded || disposed) return;
    reloaded = true;
    options.reload();
  };

  const onMessage = (event: MessageEvent) => {
    const message = parseWorkerMessage(event.data);
    if (!message || disposed) return;
    if (lessonsAreCovered(message.lessons, options.requiredLessons)) options.onReady();
  };

  container.addEventListener('controllerchange', onControllerChange);
  container.addEventListener('message', onMessage);

  const postSkipWaiting = () => {
    registration?.waiting?.postMessage(SKIP_WAITING);
  };

  const watch = (worker: WorkerLike | null) => {
    if (!worker || watched.has(worker)) return;
    watched.add(worker);
    const onState = () => {
      if (disposed || !registration) return;
      // `waiting` can be set for a moment during the very first install, before
      // anything controls the page. That is not an update. An update is a
      // waiting worker while a controller is already in place.
      if (worker.state === 'installed' && registration.waiting && container.controller) {
        options.onWaiting();
        if (applyRequested) postSkipWaiting();
      }
      if (worker.state === 'activated') registration.active?.postMessage(GET_STATUS);
    };
    worker.addEventListener('statechange', onState);
    cleanups.push(() => {
      worker.removeEventListener('statechange', onState);
    });
  };

  const onUpdateFound = () => {
    watch(registration?.installing ?? null);
  };

  const checkForUpdate = async () => {
    await settled;
    if (disposed || !registration) return;
    try {
      await registration.update();
    } catch (error) {
      console.error('DrawSprout could not check for an update:', error);
    }
  };

  void container.register(scriptUrl, { scope: '/', updateViaCache: 'none' })
    .then(async (created) => {
      if (disposed) return;
      registration = created;
      created.addEventListener('updatefound', onUpdateFound);
      watch(created.installing);
      if (created.waiting && container.controller) {
        options.onWaiting();
        if (applyRequested) postSkipWaiting();
      }
      created.active?.postMessage(GET_STATUS);
      try {
        await created.update();
      } catch (error) {
        console.error('DrawSprout could not check for an update:', error);
      }
    })
    .catch((error: unknown) => {
      console.error('DrawSprout could not register offline support:', error);
    })
    .finally(() => {
      resolveSettled();
    });

  return {
    applyUpdate() {
      applyRequested = true;
      postSkipWaiting();
    },
    checkForUpdate,
    settled,
    dispose() {
      disposed = true;
      container.removeEventListener('controllerchange', onControllerChange);
      container.removeEventListener('message', onMessage);
      registration?.removeEventListener('updatefound', onUpdateFound);
      for (const cleanup of cleanups) cleanup();
      resolveSettled();
    },
  };
}
