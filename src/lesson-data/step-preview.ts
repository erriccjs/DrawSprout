/**
 * How a lesson step is drawn in the example.
 *
 * A how-to-draw page shows what is already drawn in dark ink, the lines of
 * this step in red, and a dashed construction guide only while it is useful.
 * Later steps drop that guide. Colour steps fill flat regions and keep every
 * final outline, with no construction left on the page.
 *
 * The example panel and the contact-sheet renderer both read this model, so
 * a photo lesson and a bundled lesson cannot drift apart.
 */

import type { LessonPackage, LessonStep } from './schema';

export const PREVIEW_INK = {
  new: '#e23b3b',
  earlier: '#2c2c2c',
  construction: '#b5b5b5',
} as const;

export type PreviewKind = keyof typeof PREVIEW_INK;

export interface PreviewStroke {
  readonly id: string;
  readonly d: string;
  readonly kind: PreviewKind;
}

export interface PreviewFill {
  readonly id: string;
  readonly d: string;
  /** A #rrggbb colour, or `paper` for a region that is still to come. */
  readonly fill: string;
}

export interface StepPreview {
  readonly strokes: readonly PreviewStroke[];
  readonly fills: readonly PreviewFill[];
  readonly activeOutlines: readonly PreviewStroke[];
}

const PAPER = 'paper';

export function stepPreview(
  lesson: Pick<LessonPackage, 'steps' | 'colorRegions'>,
  stepIndex: number,
): StepPreview {
  const step = lesson.steps[stepIndex];
  if (!step) return { strokes: [], fills: [], activeOutlines: [] };

  return {
    strokes: strokesFor(lesson.steps, stepIndex, step),
    fills: fillsFor(lesson, stepIndex, step),
    activeOutlines: step.phase === 'color'
      ? lesson.colorRegions
        .filter((region) => step.colorRegionIds.includes(region.id))
        .map((region) => ({ id: `active-${region.id}`, d: region.d, kind: 'new' as const }))
      : [],
  };
}

function strokesFor(steps: readonly LessonStep[], stepIndex: number, step: LessonStep): PreviewStroke[] {
  const strokes: PreviewStroke[] = [];
  const through = step.phase === 'color' ? steps.length : stepIndex + 1;
  for (let index = 0; index < through; index += 1) {
    const earlier = steps[index];
    if (!earlier || earlier.phase === 'color') continue;
    const current = step.phase !== 'color' && index === stepIndex;
    for (const guide of earlier.guidePaths) {
      if (guide.role !== 'final-outline') continue;
      strokes.push({ id: guide.id, d: guide.d, kind: current ? 'new' : 'earlier' });
    }
  }
  if (step.phase !== 'color') {
    for (const guide of step.guidePaths) {
      if (guide.role === 'construction') {
        strokes.push({ id: guide.id, d: guide.d, kind: 'construction' });
      }
    }
  }
  return strokes;
}

function fillsFor(
  lesson: Pick<LessonPackage, 'steps' | 'colorRegions'>,
  stepIndex: number,
  step: LessonStep,
): PreviewFill[] {
  if (step.phase !== 'color') return [];
  const fills: PreviewFill[] = [];
  for (const item of lesson.steps.slice(0, stepIndex + 1)) {
    if (item.phase !== 'color') continue;
    for (const region of lesson.colorRegions) {
      if (!item.colorRegionIds.includes(region.id)) continue;
      fills.push({ id: `${item.id}-${region.id}`, d: region.d, fill: item.toolPreset.color });
    }
  }
  const later = new Set(lesson.steps.slice(stepIndex + 1).flatMap((item) => item.colorRegionIds));
  for (const region of lesson.colorRegions) {
    if (!later.has(region.id)) continue;
    fills.push({ id: `future-${region.id}`, d: region.d, fill: PAPER });
  }
  return fills;
}

export function previewStrokeWidth(kind: PreviewKind): number {
  if (kind === 'new') return 10;
  if (kind === 'earlier') return 6;
  return 4;
}
