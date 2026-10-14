import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAT_LESSON } from './cat-lesson';

async function loadBundled() {
  vi.resetModules();
  return await import('./index');
}

afterEach(() => {
  vi.doUnmock('./cat-lesson');
  vi.resetModules();
});

describe('bundled lessons', () => {
  it('exposes the hand-authored lessons the picker renders', async () => {
    const { BUNDLED_LESSONS, getLesson } = await loadBundled();
    expect(BUNDLED_LESSONS.map((lesson) => lesson.id)).toContain(CAT_LESSON.id);
    expect(getLesson(CAT_LESSON.id).title).toBe(CAT_LESSON.title);
  });

  it('refuses a package the picker could only render partially', async () => {
    vi.doMock('./cat-lesson', () => ({
      CAT_LESSON: { ...CAT_LESSON, coordinateSpace: { ...CAT_LESSON.coordinateSpace, width: 0 } },
    }));
    await expect(loadBundled()).rejects.toThrow(/coordinateSpace must have a positive width and height/);
  });

  it('refuses a package whose preview geometry is not plain path data', async () => {
    vi.doMock('./cat-lesson', () => ({
      CAT_LESSON: {
        ...CAT_LESSON,
        targetPreview: {
          ...CAT_LESSON.targetPreview,
          paths: [{ ...CAT_LESSON.targetPreview.paths[0]!, d: 'M0 0 L10 10 url(#x)' }],
        },
      },
    }));
    await expect(loadBundled()).rejects.toThrow(/outside the allowed path subset/);
  });
});
