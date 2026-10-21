/**
 * Re-render the lesson lines and compare them with the illustration ink.
 *
 * PRD section 11 step 6 sends a material mismatch back to review. The overlap
 * number is a spike heuristic, not the section 8 go/no-go score.
 */

import type { LessonPackage } from '../lesson-data/schema';
import { LESSON_HEIGHT, LESSON_WIDTH } from './lesson-build';
import type { RgbaImage } from './png';

/** Below this ink overlap, the parent is asked to look again. */
export const REVIEW_DICE_BELOW = 0.22;

export interface RenderComparison {
  readonly dice: number;
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
}

export function compareLessonToInk(lesson: LessonPackage, ink: RgbaImage): RenderComparison {
  const drawn = rasterizeLesson(lesson, ink.width, ink.height);
  const target = inkMask(ink);
  let intersection = 0;
  let drawnCount = 0;
  let targetCount = 0;
  for (let i = 0; i < drawn.length; i += 1) {
    const left = drawn[i] ?? 0;
    const right = target[i] ?? 0;
    if (left) drawnCount += 1;
    if (right) targetCount += 1;
    if (left && right) intersection += 1;
  }
  const dice = drawnCount + targetCount === 0 ? 0 : (2 * intersection) / (drawnCount + targetCount);
  if (dice < REVIEW_DICE_BELOW) {
    return {
      dice,
      needsReview: true,
      reviewReason: 'Garis pelajaran terlalu berbeda dari ilustrasi. Cek dulu sebelum dipakai.',
    };
  }
  return { dice, needsReview: false, reviewReason: null };
}

/** Lines from the first `count` steps only, so a contact sheet can show the lesson building up. */
export function renderCumulativeStep(lesson: LessonPackage, count: number, width: number): RgbaImage {
  const steps = lesson.steps.slice(0, Math.max(0, count));
  const regionIds = new Set(steps.flatMap((step) => step.colorRegionIds));
  const regions = lesson.colorRegions
    .filter((region) => regionIds.has(region.id))
    .map((region) => ({ id: region.id, d: region.d, role: 'final-outline' as const }));
  return renderLessonPreview({ ...lesson, steps, targetPreview: { paths: regions } }, width);
}

export function renderLessonPreview(lesson: LessonPackage, width: number): RgbaImage {
  const height = Math.max(1, Math.round(width * (LESSON_HEIGHT / LESSON_WIDTH)));
  const mask = rasterizeLesson(lesson, width, height);
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < mask.length; i += 1) {
    const on = mask[i] === 1;
    const o = i * 4;
    data[o] = on ? 30 : 255;
    data[o + 1] = on ? 30 : 255;
    data[o + 2] = on ? 30 : 255;
    data[o + 3] = 255;
  }
  return { width, height, data };
}

function inkMask(image: RgbaImage): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; i < mask.length; i += 1, p += 4) {
    const lum = 0.2126 * (image.data[p] ?? 255) + 0.7152 * (image.data[p + 1] ?? 255) + 0.0722 * (image.data[p + 2] ?? 255);
    if (lum < 170) mask[i] = 1;
  }
  return mask;
}

function rasterizeLesson(lesson: LessonPackage, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const paths = [
    ...lesson.targetPreview.paths,
    ...lesson.steps.flatMap((step) => step.guidePaths),
  ];
  for (const path of paths) {
    const points = parsePath(path.d);
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1]!;
      const to = points[index]!;
      drawLine(
        mask,
        width,
        height,
        scale(from.x, LESSON_WIDTH, width),
        scale(from.y, LESSON_HEIGHT, height),
        scale(to.x, LESSON_WIDTH, width),
        scale(to.y, LESSON_HEIGHT, height),
      );
    }
  }
  return mask;
}

function parsePath(d: string): Array<{ x: number; y: number }> {
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+/gi) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  let index = 0;
  let start: { x: number; y: number } | null = null;
  let cursor: { x: number; y: number } | undefined;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token === 'M' || token === 'm') {
      cursor = { x: number(tokens[index + 1]), y: number(tokens[index + 2]) };
      start = cursor;
      points.push(cursor);
      index += 3;
    } else if (token === 'L' || token === 'l') {
      cursor = { x: number(tokens[index + 1]), y: number(tokens[index + 2]) };
      points.push(cursor);
      index += 3;
    } else if (token === 'Z' || token === 'z') {
      if (start) points.push(start);
      index += 1;
    } else {
      index += 1;
    }
  }
  return points;
}

function drawLine(mask: Uint8Array, width: number, height: number, x0: number, y0: number, x1: number, y1: number): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const dy = Math.abs(endY - y);
  const sx = x < endX ? 1 : -1;
  const sy = y < endY ? 1 : -1;
  let error = dx - dy;
  for (let guard = 0; guard < width * height; guard += 1) {
    stamp(mask, width, height, x, y);
    if (x === endX && y === endY) break;
    const doubled = 2 * error;
    if (doubled > -dy) {
      error -= dy;
      x += sx;
    }
    if (doubled < dx) {
      error += dx;
      y += sy;
    }
  }
}

function stamp(mask: Uint8Array, width: number, height: number, x: number, y: number): void {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const sx = x + dx;
      const sy = y + dy;
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) mask[sy * width + sx] = 1;
    }
  }
}

function scale(value: number, from: number, to: number): number {
  return (value / from) * (to - 1);
}

function number(token: string | undefined): number {
  return token === undefined ? 0 : Number(token);
}
