export * from './types';
export * from './mapping';
export { IndexedDbSessionStore, openDatabase, requestPersistentStorage } from './indexeddb-store';
export { MemorySessionStore } from './memory-store';

import { IndexedDbSessionStore } from './indexeddb-store';
import { MemorySessionStore } from './memory-store';
import type { SessionStore } from './types';

export interface StoreSelection {
  readonly store: SessionStore;
  /** `false` means the work will not survive a reload; the UI says so. */
  readonly durable: boolean;
}

/**
 * Picks the best available store.
 *
 * IndexedDB is the only durable option (FR-13). When it is missing or blocked,
 * the session still runs on the in-memory store, but `durable` is false so the
 * UI can warn instead of claiming the artwork is saved (PRD section 14,
 * "Storage browser hilang").
 */
export async function createSessionStore(): Promise<StoreSelection> {
  if (typeof indexedDB === 'undefined') {
    return { store: new MemorySessionStore(), durable: false };
  }
  try {
    const store = new IndexedDbSessionStore();
    // Force the open to settle now, so a blocked or disabled database surfaces
    // here rather than on the first autosave mid-drawing.
    await store.loadPreferences();
    return { store, durable: true };
  } catch {
    return { store: new MemorySessionStore(), durable: false };
  }
}
