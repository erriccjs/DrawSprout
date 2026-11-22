import { describe, expect, it } from 'vitest';
import { lessonsForPicker } from './library';
import {
  BEGINNER_PATH,
  NEAR_DUPLICATE_PAIRS,
  hasLessonMeta,
  lessonDifficulty,
  nextBeginnerLesson,
} from './growth';

describe('beginner path and lesson groups', () => {
  it('gives every picture on the list a theme and a difficulty', () => {
    const ids = lessonsForPicker().map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(hasLessonMeta(id), id).toBe(true);
    for (const id of BEGINNER_PATH) {
      expect(ids).toContain(id);
      expect(lessonDifficulty(id)).toBe('easy');
    }
    expect(BEGINNER_PATH).toHaveLength(8);
  });

  it('keeps the near-duplicate pairs and starts the path at the first unstamped lesson', () => {
    const ids = lessonsForPicker().map((lesson) => lesson.id);
    for (const [left, right] of NEAR_DUPLICATE_PAIRS) {
      expect(ids).toContain(left);
      expect(ids).toContain(right);
    }
    expect(nextBeginnerLesson(ids, [])).toBe(BEGINNER_PATH[0]);
    expect(nextBeginnerLesson(ids, [BEGINNER_PATH[0], BEGINNER_PATH[1]])).toBe(BEGINNER_PATH[2]);
    expect(nextBeginnerLesson(ids, [...BEGINNER_PATH])).toBe(BEGINNER_PATH[0]);
    expect(nextBeginnerLesson(['not-a-path'], [])).toBeNull();
  });
});
