import { describe, expect, it } from 'vitest';
import { BUNDLED_LESSONS, getLesson } from './index';
import { CAT_LESSON } from './cat-lesson';
import { FLOWER_LESSON } from './flower-lesson';
import { FISH_LESSON } from './fish-lesson';
import { SUN_LESSON } from './sun-lesson';
import { TREE_LESSON } from './tree-lesson';
import { assertValidLessons } from './validate';

describe('bundled lessons', () => {
  it('exposes the hand-authored lessons the picker renders', () => {
    expect(BUNDLED_LESSONS.map((lesson) => lesson.id)).toEqual([
      CAT_LESSON.id,
      FLOWER_LESSON.id,
      FISH_LESSON.id,
      SUN_LESSON.id,
      TREE_LESSON.id,
    ]);
    expect(getLesson(CAT_LESSON.id).title).toBe(CAT_LESSON.title);
    expect(getLesson(FLOWER_LESSON.id).title).toBe(FLOWER_LESSON.title);
    expect(getLesson(FISH_LESSON.id).title).toBe(FISH_LESSON.title);
    expect(getLesson(SUN_LESSON.id).title).toBe(SUN_LESSON.title);
    expect(getLesson(TREE_LESSON.id).title).toBe(TREE_LESSON.title);
  });

  it('ships only packages the picker can render in full', () => {
    expect(() => assertValidLessons(BUNDLED_LESSONS)).not.toThrow();
  });

  it('gives every sun guide a unique id', () => {
    const ids = SUN_LESSON.steps.flatMap((step) => step.guidePaths.map((path) => path.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every tree guide a unique id and valid colour regions', () => {
    const ids = TREE_LESSON.steps.flatMap((step) => step.guidePaths.map((path) => path.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(() => assertValidLessons([TREE_LESSON])).not.toThrow();
  });

  it('refuses a lesson id nothing ships', () => {
    expect(() => getLesson('no-such-lesson')).toThrow(/no-such-lesson/);
  });
});
