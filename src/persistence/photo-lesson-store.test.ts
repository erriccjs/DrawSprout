import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CAT_LESSON } from '../lesson-data';
import { IndexedDbPhotoLessonStore, MemoryPhotoLessonStore, type PhotoLessonRecord, type PhotoLessonStore } from './photo-lesson-store';

function record(id: string, createdAt: number): PhotoLessonRecord {
  return {
    id,
    targetHash: `hash-${id}`,
    createdAt,
    lesson: { ...CAT_LESSON, id, title: 'Dari foto', subtitle: 'Dari foto', contentVersion: `photo-${id}` },
  };
}

describe.each([
  ['memory', () => new MemoryPhotoLessonStore()],
  ['indexeddb', () => new IndexedDbPhotoLessonStore(new IDBFactory())],
])('photo lessons (%s)', (_name, makeStore) => {
  let store: PhotoLessonStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('saves the lesson and hash, not a photo', async () => {
    await store.put(record('photo-a', 2));
    await store.put(record('photo-b', 1));
    const listed = await store.list();
    expect(listed.map((item) => item.id)).toEqual(['photo-a', 'photo-b']);
    expect(Object.keys(listed[0] ?? {})).toEqual(['id', 'targetHash', 'createdAt', 'lesson']);
    await store.delete('photo-a');
    expect((await store.list()).map((item) => item.id)).toEqual(['photo-b']);
    store.close();
  });
});
