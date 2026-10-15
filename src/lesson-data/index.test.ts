import { describe, expect, it } from 'vitest';
import { BUNDLED_LESSONS, getLesson } from './index';
import { CAT_LESSON } from './cat-lesson';
import { assertValidLessons } from './validate';

describe('bundled lessons', () => {
  it('exposes the hand-authored lessons the picker renders', () => {
    expect(BUNDLED_LESSONS.map((lesson) => lesson.id)).toContain(CAT_LESSON.id);
    expect(getLesson(CAT_LESSON.id).title).toBe(CAT_LESSON.title);
  });

  it('ships only packages the picker can render in full', () => {
    expect(() => assertValidLessons(BUNDLED_LESSONS)).not.toThrow();
  });

  it('refuses a lesson id nothing ships', () => {
    expect(() => getLesson('no-such-lesson')).toThrow(/no-such-lesson/);
  });
});
