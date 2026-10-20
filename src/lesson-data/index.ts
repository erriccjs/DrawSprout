export * from './schema';
export * from './validate';
export { CAT_LESSON } from './cat-lesson';
export { FLOWER_LESSON } from './flower-lesson';
export { FISH_LESSON } from './fish-lesson';
export { SUN_LESSON } from './sun-lesson';
export { TREE_LESSON } from './tree-lesson';

import { CAT_LESSON } from './cat-lesson';
import { FLOWER_LESSON } from './flower-lesson';
import { FISH_LESSON } from './fish-lesson';
import { SUN_LESSON } from './sun-lesson';
import { TREE_LESSON } from './tree-lesson';
import type { LessonPackage } from './schema';

/**
 * Every lesson shipped in the app. The picker reads this list directly, so
 * session bootstrap validates it with `assertValidLessons` before anything is
 * rendered: PRD section 14 requires an invalid package to refuse rather than be
 * rendered partially.
 */
export const BUNDLED_LESSONS: readonly LessonPackage[] = [CAT_LESSON, FLOWER_LESSON, FISH_LESSON, SUN_LESSON, TREE_LESSON];

/** Looks a lesson up; bootstrap has already validated the list it comes from. */
export function getLesson(lessonId: string): LessonPackage {
  const lesson = BUNDLED_LESSONS.find((candidate) => candidate.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson "${lessonId}"`);
  return lesson;
}
