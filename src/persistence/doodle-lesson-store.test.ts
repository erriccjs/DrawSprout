import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { CAT_LESSON } from '../lesson-data';
import { IndexedDbDoodleLessonStore, MemoryDoodleLessonStore, type DoodleLessonRecord, type DoodleLessonStore } from './doodle-lesson-store';

function record(id: string, createdAt: number, traced = false): DoodleLessonRecord {
  return {
    id,
    createdAt,
    traced,
    png: Uint8Array.from([137, 80, 78, 71, createdAt]),
    lesson: { ...CAT_LESSON, id, title: 'Doodle dari foto', subtitle: 'Dari doodle', contentVersion: 'doodle-1' },
  };
}

describe.each([
  ['memory', () => new MemoryDoodleLessonStore()],
  ['indexeddb', () => new IndexedDbDoodleLessonStore(new IDBFactory())],
])('doodle lessons (%s)', (_name, makeStore) => {
  let store: DoodleLessonStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('saves the lesson and the line drawing, not the original photo', async () => {
    await store.put(record('doodle-a', 2, true));
    await store.put(record('doodle-b', 1));
    const listed = await store.list();
    expect(listed.map((item) => item.id)).toEqual(['doodle-a', 'doodle-b']);
    expect(Object.keys(listed[0] ?? {}).sort()).toEqual(['createdAt', 'id', 'lesson', 'png', 'traced']);
    expect(Array.from(listed[0]?.png ?? [])).toEqual([137, 80, 78, 71, 2]);
    expect(listed[0]?.traced).toBe(true);
    expect(JSON.stringify(listed[0])).not.toContain('photo');
    await store.delete('doodle-a');
    expect((await store.list()).map((item) => item.id)).toEqual(['doodle-b']);
    store.close();
  });
});
