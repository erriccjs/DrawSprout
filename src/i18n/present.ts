/**
 * The words a child sees for a lesson. Indonesian is the package itself.
 * English comes from the catalogue, or from the photo-lesson sentence frames
 * when the lesson was built from a photo.
 */

import type { ColorRegion, LessonPackage, LessonStep } from '../lesson-data/schema';
import { localizeSentence, say } from './generated';
import type { Locale } from './locale';
import { CATEGORY_EN, CATEGORY_LESSON_EN } from './lessons-category';
import { LESSON_EN as BUNDLED_EN, type LessonEnglish } from './lessons-bundled';

export const LESSON_EN: Readonly<Record<string, LessonEnglish>> = {
  ...BUNDLED_EN,
  ...CATEGORY_LESSON_EN,
};

export function categoryName(locale: Locale, id: string, fallback: string): string {
  if (locale === 'id') return fallback;
  return CATEGORY_EN[id] ?? fallback;
}

function stepCopy(step: LessonStep, instruction: string, hint: string | undefined): LessonStep {
  if (hint === undefined) return { ...step, instruction };
  return { ...step, instruction, hint };
}

function englishStep(lessonId: string, step: LessonStep): LessonStep {
  const copy = LESSON_EN[lessonId]?.steps[step.id];
  if (copy) return stepCopy(step, copy.instruction, copy.hint);
  return stepCopy(step, localizeSentence(step.instruction), step.hint === undefined ? undefined : localizeSentence(step.hint));
}

function englishRegion(lessonId: string, region: ColorRegion): ColorRegion {
  const label = LESSON_EN[lessonId]?.regions[region.id];
  return label === undefined ? { ...region, label: localizeSentence(region.label) } : { ...region, label };
}

/** A lesson whose visible words match `locale`. Geometry and ids stay the same. */
export function presentLesson(lesson: LessonPackage, locale: Locale): LessonPackage {
  if (locale === 'id') return lesson;
  const copy = LESSON_EN[lesson.id];
  return {
    ...lesson,
    title: copy?.title ?? say('en', lesson.title),
    subtitle: copy?.subtitle ?? say('en', lesson.subtitle),
    steps: lesson.steps.map((step) => englishStep(lesson.id, step)),
    colorRegions: lesson.colorRegions.map((region) => englishRegion(lesson.id, region)),
  };
}
