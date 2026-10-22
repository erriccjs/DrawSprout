export * from './schema';
export * from './validate';
export { CAT_LESSON } from './cat-lesson';
export { FLOWER_LESSON } from './flower-lesson';
export { FISH_LESSON } from './fish-lesson';
export { SUN_LESSON } from './sun-lesson';
export { TREE_LESSON } from './tree-lesson';
export { BASKETBALL_LESSON } from './basketball-lesson';
export { HOUSE_LESSON } from './house-lesson';
export { CAR_LESSON } from './car-lesson';
export { BUTTERFLY_LESSON } from './butterfly-lesson';
export { STAR_LESSON } from './star-lesson';

import { CAT_LESSON } from './cat-lesson';
import { FLOWER_LESSON } from './flower-lesson';
import { FISH_LESSON } from './fish-lesson';
import { SUN_LESSON } from './sun-lesson';
import { TREE_LESSON } from './tree-lesson';
import { BASKETBALL_LESSON } from './basketball-lesson';
import { HOUSE_LESSON } from './house-lesson';
import { CAR_LESSON } from './car-lesson';
import { BUTTERFLY_LESSON } from './butterfly-lesson';
import { STAR_LESSON } from './star-lesson';
import type { LessonPackage } from './schema';

/**
 * The original picture catalogue. The choosing screen also lists every done
 * category lesson (`lessonsForPicker`). Bootstrap validates this list before
 * anything is rendered: PRD section 14 requires an invalid package to refuse
 * rather than be rendered partially.
 */
export const BUNDLED_LESSONS: readonly LessonPackage[] = [
  CAT_LESSON,
  FLOWER_LESSON,
  FISH_LESSON,
  SUN_LESSON,
  TREE_LESSON,
  BASKETBALL_LESSON,
  HOUSE_LESSON,
  CAR_LESSON,
  BUTTERFLY_LESSON,
  STAR_LESSON,
];

/** Looks a lesson up; bootstrap has already validated the list it comes from. */
export function getLesson(lessonId: string): LessonPackage {
  const lesson = BUNDLED_LESSONS.find((candidate) => candidate.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson "${lessonId}"`);
  return lesson;
}
