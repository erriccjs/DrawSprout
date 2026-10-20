/**
 * Offline status the page can render.
 *
 * Registration callbacks publish here. The React hook subscribes. Tests can
 * publish the same events the worker would, because the UI decision must not
 * depend on a real worker being installed.
 */

export interface OfflineSnapshot {
  readonly ready: boolean;
  readonly updateWaiting: boolean;
  readonly applyRequested: boolean;
}

const INITIAL: OfflineSnapshot = {
  ready: false,
  updateWaiting: false,
  applyRequested: false,
};

let snapshot: OfflineSnapshot = INITIAL;
const listeners = new Set<() => void>();

export function getOfflineSnapshot(): OfflineSnapshot {
  return snapshot;
}

export function subscribeOffline(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: OfflineSnapshot): void {
  if (
    next.ready === snapshot.ready
    && next.updateWaiting === snapshot.updateWaiting
    && next.applyRequested === snapshot.applyRequested
  ) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

export function markOfflineReady(): void {
  publish({ ...snapshot, ready: true });
}

export function markUpdateWaiting(): void {
  publish({ ...snapshot, updateWaiting: true });
}

export function requestOfflineApply(): void {
  publish({ ...snapshot, applyRequested: true });
}

/** Returns the store to its initial snapshot. Safe to call between tests. */
export function resetOfflineStatus(): void {
  snapshot = INITIAL;
  for (const listener of listeners) listener();
}
