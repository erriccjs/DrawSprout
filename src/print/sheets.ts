/**
 * The pages a family can print for one lesson.
 *
 * Practice pages keep each step's own dashed guides, in the same coordinate
 * space as the screen. The colouring page is the outline only: final lines,
 * stroked and not filled. Nothing here is uploaded.
 */

import type { CoordinateSpace, GuideRole, LessonPackage } from '../lesson-data/schema';

export const PRACTICE_STEPS_PER_PAGE = 6;

export interface SheetLabels {
  readonly picture: string;
  readonly practice: string;
  readonly colouring: string;
  readonly madeHere: string;
  readonly noLines: string;
}

export interface SheetPath {
  readonly d: string;
  readonly role: GuideRole;
}

export interface PracticeStepView {
  readonly number: number;
  readonly instruction: string;
  readonly paths: readonly SheetPath[];
}

export interface SheetView {
  readonly kind: 'picture' | 'practice' | 'colouring';
  readonly heading: string;
  readonly lessonTitle: string;
  readonly dateLabel: string;
  readonly steps: readonly PracticeStepView[];
  readonly outlines: readonly SheetPath[];
  readonly note: string;
}

export function buildSheets(
  lesson: LessonPackage,
  options: { readonly includePicture: boolean; readonly dateLabel: string; readonly labels: SheetLabels },
): SheetView[] {
  const pages: SheetView[] = [];
  const base = { lessonTitle: lesson.title, dateLabel: options.dateLabel };
  if (options.includePicture) {
    pages.push({
      ...base,
      kind: 'picture',
      heading: options.labels.picture,
      steps: [],
      outlines: [],
      note: options.labels.madeHere,
    });
  }

  const guided: PracticeStepView[] = [];
  for (const step of lesson.steps) {
    if (step.guidePaths.length === 0) continue;
    guided.push({
      number: guided.length + 1,
      instruction: step.instruction,
      paths: step.guidePaths.map((path) => ({ d: path.d, role: path.role })),
    });
  }
  if (guided.length === 0) {
    pages.push({
      ...base,
      kind: 'practice',
      heading: options.labels.practice,
      steps: [],
      outlines: [],
      note: options.labels.noLines,
    });
  } else {
    for (let start = 0; start < guided.length; start += PRACTICE_STEPS_PER_PAGE) {
      pages.push({
        ...base,
        kind: 'practice',
        heading: options.labels.practice,
        steps: guided.slice(start, start + PRACTICE_STEPS_PER_PAGE),
        outlines: [],
        note: options.labels.madeHere,
      });
    }
  }

  const outlines = colouringOutlines(lesson);
  pages.push({
    ...base,
    kind: 'colouring',
    heading: options.labels.colouring,
    steps: [],
    outlines,
    note: outlines.length === 0 ? options.labels.noLines : options.labels.madeHere,
  });
  return pages;
}

/** Final outlines, once each. Construction guides stay off the colouring page. */
export function colouringOutlines(lesson: LessonPackage): SheetPath[] {
  const seen = new Set<string>();
  const outlines: SheetPath[] = [];
  const add = (d: string, role: GuideRole) => {
    const key = d.replace(/\s+/g, ' ').trim();
    if (key === '' || seen.has(key)) return;
    seen.add(key);
    outlines.push({ d, role });
  };
  for (const step of lesson.steps) {
    for (const path of step.guidePaths) {
      if (path.role === 'final-outline') add(path.d, 'final-outline');
    }
  }
  if (outlines.length === 0) {
    for (const step of lesson.steps) {
      for (const path of step.guidePaths) add(path.d, 'final-outline');
    }
  }
  if (outlines.length === 0) {
    for (const region of lesson.colorRegions) add(region.d, 'final-outline');
  }
  return outlines;
}

export function sheetSpace(lesson: Pick<LessonPackage, 'coordinateSpace'>): CoordinateSpace {
  return lesson.coordinateSpace;
}
