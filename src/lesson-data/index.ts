export * from './schema';
export * from './validate';
export { CAT_LESSON } from './cat-lesson';

import { CAT_LESSON } from './cat-lesson';
import { assertValidLesson } from './validate';
import type { LessonPackage } from './schema';

/**
 * Every lesson shipped in the app. The picker reads this list directly.
 */
export const BUNDLED_LESSONS: readonly LessonPackage[] = [CAT_LESSON];

/**
 * Looks a lesson up and validates it before anyone can draw with it. PRD
 * section 14 requires an invalid package to refuse to open rather than render
 * partially, so this throws instead of returning a half-usable lesson.
 */
export function getLesson(lessonId: string): LessonPackage {
  const lesson = BUNDLED_LESSONS.find((candidate) => candidate.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson "${lessonId}"`);
  return assertValidLesson(lesson);
}
