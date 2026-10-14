export * from './schema';
export * from './validate';
export { CAT_LESSON } from './cat-lesson';

import { CAT_LESSON } from './cat-lesson';
import { assertValidLesson } from './validate';
import type { LessonPackage } from './schema';

/**
 * Every lesson shipped in the app. The picker reads this list directly, so each
 * package is validated here: PRD section 14 requires an invalid package to
 * refuse rather than be rendered partially, and the picker draws a tile from a
 * package before anyone taps it.
 */
export const BUNDLED_LESSONS: readonly LessonPackage[] = [CAT_LESSON].map((lesson) =>
  assertValidLesson(lesson),
);

/** Looks a lesson up; the list it comes from is already validated. */
export function getLesson(lessonId: string): LessonPackage {
  const lesson = BUNDLED_LESSONS.find((candidate) => candidate.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson "${lessonId}"`);
  return lesson;
}
