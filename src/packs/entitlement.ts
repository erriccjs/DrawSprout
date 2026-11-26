/**
 * What this device may open.
 *
 * The record is local. A later Play Billing or web payment grant can write the
 * same shape. The placeholder source means a parent opened a pack on this
 * device while the freemium flag was on. There is no receipt and no charge.
 */

export type EntitlementSource = 'placeholder' | 'play' | 'web';

export interface DeviceEntitlement {
  readonly version: 1;
  readonly packs: readonly string[];
  readonly source: EntitlementSource;
  readonly grantedAt: number;
}

export interface EntitlementStore {
  read(): Promise<DeviceEntitlement | null>;
  grant(packId: string, source?: EntitlementSource, at?: number): Promise<DeviceEntitlement>;
  close(): void;
}

const EMPTY: DeviceEntitlement = { version: 1, packs: [], source: 'placeholder', grantedAt: 0 };

export class MemoryEntitlementStore implements EntitlementStore {
  private record: DeviceEntitlement | null = null;

  read(): Promise<DeviceEntitlement | null> {
    return Promise.resolve(this.record);
  }

  grant(packId: string, source: EntitlementSource = 'placeholder', at = Date.now()): Promise<DeviceEntitlement> {
    const packs = [...new Set([...(this.record?.packs ?? []), packId])];
    this.record = { version: 1, packs, source, grantedAt: at };
    return Promise.resolve(this.record);
  }

  close(): void {
    /* Nothing to release. */
  }
}

const DB_NAME = 'drawsprout-entitlement';
const DB_VERSION = 1;
const STORE = 'grants';
const KEY = 'device';

export class IndexedDbEntitlementStore implements EntitlementStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('entitlement'));
      });
    }
    return this.db;
  }

  async read(): Promise<DeviceEntitlement | null> {
    const db = await this.open();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(isEntitlement(request.result) ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('entitlement'));
    });
  }

  async grant(packId: string, source: EntitlementSource = 'placeholder', at = Date.now()): Promise<DeviceEntitlement> {
    const current = (await this.read()) ?? EMPTY;
    const next: DeviceEntitlement = {
      version: 1,
      packs: [...new Set([...current.packs, packId])],
      source,
      grantedAt: at,
    };
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(next, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('entitlement'));
    });
    return next;
  }

  close(): void {
    void this.db?.then((db) => db.close()).catch(() => undefined);
    this.db = null;
  }
}

function isEntitlement(value: unknown): value is DeviceEntitlement {
  if (value === null || typeof value !== 'object') return false;
  const record = value as DeviceEntitlement;
  return record.version === 1 && Array.isArray(record.packs) && record.packs.every((id) => typeof id === 'string');
}

export function deviceMayOpen(entitlement: DeviceEntitlement | null, packId: string): boolean {
  return entitlement?.packs.includes(packId) ?? false;
}
