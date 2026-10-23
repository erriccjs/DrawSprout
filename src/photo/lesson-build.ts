/**
 * Traced lines become a lesson. A named part keeps its real outline.
 *
 * A circle or oval is added first only when it fits that outline. When the
 * vision model names nothing usable, the lesson falls back to one named
 * outline and drops unnamed scraps instead of printing a generic sentence.
 * `buildTutorialLesson` orders the steps like a how-to-draw page: one
 * dashed circle or oval at about 90% of the main mass, then one part at a time
 * (D-77, D-78, D-79, D-80). The line art itself stays a faithful drawing of the photo.
 * `buildPhotoLesson` stays for the earlier pins.
 * See D-70, D-71, D-72, D-73, D-76, D-77, D-78, and D-79.
 *
 * The work is split under ./lesson/: geometry, instruction text, validation,
 * and assembly. This file re-exports the public API.
 */

export {
  CONSTRUCTION_IOU_MIN,
  LESSON_HEIGHT,
  LESSON_WIDTH,
  OUTLINE_COVERAGE_MIN,
  TUTORIAL_DRAWING_MAX,
} from './lesson/types';
export type { BuiltLesson, LessonPiece } from './lesson/types';
export { imageRect, lessonPieces, outlineCoverage, shouldRedraw } from './lesson/geometry';
export {
  fixVerb,
  isBackgroundPart,
  isGenericInstruction,
  normalizeInstruction,
  partNoun,
  sanitizeTitle,
  uniquifyInstructions,
} from './lesson/words';
export { buildNamedLesson, buildPhotoLesson, buildTutorialLesson } from './lesson/assemble';
