/**
 * Photo lessons, separate from the session database.
 *
 * The session database stays at version 1. A photo lesson is the vector
 * package plus the locked target hash. The source photo and the illustration
 * PNG are not stored. Deleting a record does not delete drawings; the caller
 * also deletes sessions for that lesson id.
 */

import type { LessonPackage } from '../lesson-data/schema';

export interface PhotoLessonRecord {
  readonly id: string;
  readonly targetHash: string;
  readonly createdAt: number;
  readonly lesson: LessonPackage;
}

export interface PhotoLessonStore {
  list(): Promise<readonly PhotoLessonRecord[]>;
  put(record: PhotoLessonRecord): Promise<void>;
  delete(id: string): Promise<void>;
  close(): void;
}

const DB_NAME = 'drawsprout-photo-lessons';
const DB_VERSION = 1;
const LESSONS = 'lessons';

export class MemoryPhotoLessonStore implements PhotoLessonStore {
  private readonly records = new Map<string, PhotoLessonRecord>();

  list(): Promise<readonly PhotoLessonRecord[]> {
    return Promise.resolve(sorted(this.records.values()));
  }

  put(record: PhotoLessonRecord): Promise<void> {
    this.records.set(record.id, record);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }

  close(): void {
    /* nothing to release */
  }
}

export class IndexedDbPhotoLessonStore implements PhotoLessonStore {
  private readonly dbPromise: Promise<IDBDatabase>;
  private db: IDBDatabase | null = null;

  constructor(indexedDb: IDBFactory = indexedDB) {
    this.dbPromise = openPhotoDatabase(indexedDb).then((db) => {
      this.db = db;
      return db;
    });
  }

  async list(): Promise<readonly PhotoLessonRecord[]> {
    const db = await this.dbPromise;
    const records = await run(db, 'readonly', (store) => request<PhotoLessonRecord[]>(store.getAll()));
    return sorted(records);
  }

  async put(record: PhotoLessonRecord): Promise<void> {
    const db = await this.dbPromise;
    await run(db, 'readwrite', (store) => {
      store.put(record);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.dbPromise;
    await run(db, 'readwrite', (store) => {
      store.delete(id);
    });
  }

  close(): void {
    this.db?.close();
  }
}

function sorted(records: Iterable<PhotoLessonRecord>): PhotoLessonRecord[] {
  return [...records].sort((left, right) => right.createdAt - left.createdAt || (left.id < right.id ? 1 : -1));
}

function openPhotoDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LESSONS)) db.createObjectStore(LESSONS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open photo lessons'));
  });
}

async function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => T | Promise<T>,
): Promise<T> {
  const tx = db.transaction(LESSONS, mode);
  const completion = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('Photo lesson transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('Photo lesson transaction failed'));
  });
  completion.catch(() => undefined);
  let result: T;
  try {
    result = await work(tx.objectStore(LESSONS));
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* nothing left to abort */
    }
    throw error;
  }
  await completion;
  return result;
}

function request<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error ?? new Error('Photo lesson request failed'));
  });
}
