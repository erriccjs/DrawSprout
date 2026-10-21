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
  const radius = Math.max(1, Math.round(Math.min(ink.width, ink.height) * 0.012));
  const drawn = dilate(rasterizeLesson(lesson, ink.width, ink.height), ink.width, ink.height, radius);
  const target = dilate(subjectMask(ink), ink.width, ink.height, radius);
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
export function renderCumulativeStep(
  lesson: LessonPackage,
  count: number,
  width: number,
  base: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
): RgbaImage {
  const height = Math.max(1, Math.round(width * (LESSON_HEIGHT / LESSON_WIDTH)));
  const steps = lesson.steps.slice(0, Math.max(0, count));
  const data = new Uint8Array(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = base.r;
    data[index + 1] = base.g;
    data[index + 2] = base.b;
    data[index + 3] = 255;
  }
  for (const step of steps) {
    if (step.phase !== 'color') continue;
    for (const id of step.colorRegionIds) {
      const region = lesson.colorRegions.find((item) => item.id === id);
      if (!region) continue;
      fillPath(data, width, height, region.d, region.suggestedColor);
    }
  }
  const inkSteps = steps.filter((step) => step.phase !== 'color');
  const hasOutline = inkSteps.some((step) => step.guidePaths.some((path) => path.role === 'final-outline'));
  const finalSteps = inkSteps.map((step) => ({
    ...step,
    guidePaths: step.guidePaths.filter((path) => path.role !== 'construction'),
  }));
  const lines = rasterizeLesson({ ...lesson, steps: finalSteps, targetPreview: { paths: [] } }, width, height);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] !== 1) continue;
    const offset = i * 4;
    data[offset] = 30;
    data[offset + 1] = 30;
    data[offset + 2] = 30;
    data[offset + 3] = 255;
  }
  if (!hasOutline) {
    const guides = inkSteps.flatMap((step) => step.guidePaths.filter((path) => path.role === 'construction'));
    strokeDashed(data, width, height, guides, 176);
  }
  return { width, height, data };
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

function subjectMask(image: RgbaImage): Uint8Array {
  const ink = inkMask(image);
  let count = 0;
  let minX = image.width;
  let minY = image.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (ink[y * image.width + x] !== 1) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const box = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
  if (count === 0 || count / box < 0.45) return ink;
  return boundary(ink, image.width, image.height);
}

function boundary(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      const left = x > 0 ? mask[y * width + x - 1] : 0;
      const right = x + 1 < width ? mask[y * width + x + 1] : 0;
      const up = y > 0 ? mask[(y - 1) * width + x] : 0;
      const down = y + 1 < height ? mask[(y + 1) * width + x] : 0;
      if (!left || !right || !up || !down) out[y * width + x] = 1;
    }
  }
  return out;
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sy >= 0 && sx < width && sy < height) out[sy * width + sx] = 1;
        }
      }
    }
  }
  return out;
}

function fillPath(data: Uint8Array, width: number, height: number, d: string, color: string): void {
  const rgb = hexRgb(color);
  const points = parsePath(d).map((point) => ({
    x: scale(point.x, LESSON_WIDTH, width),
    y: scale(point.y, LESSON_HEIGHT, height),
  }));
  if (points.length < 3) return;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(width - 1, Math.ceil(maxX));
  const y1 = Math.min(height - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!pointInPolygon(x + 0.5, y + 0.5, points)) continue;
      const offset = (y * width + x) * 4;
      data[offset] = rgb.r;
      data[offset + 1] = rgb.g;
      data[offset + 2] = rgb.b;
      data[offset + 3] = 255;
    }
  }
}

function pointInPolygon(x: number, y: number, points: readonly { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    const intersect = ((a.y > y) !== (b.y > y)) && (x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

function hexRgb(color: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(color.slice(1, 3), 16) || 0,
    g: Number.parseInt(color.slice(3, 5), 16) || 0,
    b: Number.parseInt(color.slice(5, 7), 16) || 0,
  };
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
    if (path.role === 'construction') continue;
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
  const tokens = d.match(/[a-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  let index = 0;
  let start: { x: number; y: number } | null = null;
  let cursor = { x: 0, y: 0 };
  while (index < tokens.length) {
    const token = tokens[index] ?? '';
    if (!/^[a-z]$/i.test(token)) {
      index += 1;
      continue;
    }
    const command = token.toUpperCase();
    if (command === 'Z') {
      if (start) points.push(start);
      if (start) cursor = start;
      index += 1;
      continue;
    }
    if (command === 'M' || command === 'L') {
      cursor = { x: num(tokens[index + 1]), y: num(tokens[index + 2]) };
      if (command === 'M') start = cursor;
      points.push(cursor);
      index += 3;
      continue;
    }
    if (command === 'H') {
      cursor = { x: num(tokens[index + 1]), y: cursor.y };
      points.push(cursor);
      index += 2;
      continue;
    }
    if (command === 'V') {
      cursor = { x: cursor.x, y: num(tokens[index + 1]) };
      points.push(cursor);
      index += 2;
      continue;
    }
    if (command === 'Q') {
      const control = { x: num(tokens[index + 1]), y: num(tokens[index + 2]) };
      const end = { x: num(tokens[index + 3]), y: num(tokens[index + 4]) };
      points.push(...sampleQuadratic(cursor, control, end));
      cursor = end;
      index += 5;
      continue;
    }
    if (command === 'C') {
      const c1 = { x: num(tokens[index + 1]), y: num(tokens[index + 2]) };
      const c2 = { x: num(tokens[index + 3]), y: num(tokens[index + 4]) };
      const end = { x: num(tokens[index + 5]), y: num(tokens[index + 6]) };
      points.push(...sampleCubic(cursor, c1, c2, end));
      cursor = end;
      index += 7;
      continue;
    }
    if (command === 'A') {
      const end = { x: num(tokens[index + 6]), y: num(tokens[index + 7]) };
      points.push(...sampleArc(
        cursor,
        num(tokens[index + 1]),
        num(tokens[index + 2]),
        num(tokens[index + 3]),
        num(tokens[index + 4]) >= 0.5,
        num(tokens[index + 5]) >= 0.5,
        end,
      ));
      cursor = end;
      index += 8;
      continue;
    }
    index += 1;
  }
  return points;
}

function sampleQuadratic(
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    const mt = 1 - t;
    points.push({
      x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
      y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
    });
  }
  return points;
}

function sampleCubic(
  from: { x: number; y: number },
  c1: { x: number; y: number },
  c2: { x: number; y: number },
  to: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    const mt = 1 - t;
    points.push({
      x: mt * mt * mt * from.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * to.x,
      y: mt * mt * mt * from.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * to.y,
    });
  }
  return points;
}

function sampleArc(
  from: { x: number; y: number },
  rx: number,
  ry: number,
  rotationDeg: number,
  large: boolean,
  sweep: boolean,
  to: { x: number; y: number },
): Array<{ x: number; y: number }> {
  if (rx === 0 || ry === 0 || (from.x === to.x && from.y === to.y)) return [to];
  const phi = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);
  const lambda = (x1 * x1) / (rxAbs * rxAbs) + (y1 * y1) / (ryAbs * ryAbs);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rxAbs *= scale;
    ryAbs *= scale;
  }
  const sign = large === sweep ? -1 : 1;
  const numer = rxAbs * rxAbs * ryAbs * ryAbs - rxAbs * rxAbs * y1 * y1 - ryAbs * ryAbs * x1 * x1;
  const denom = rxAbs * rxAbs * y1 * y1 + ryAbs * ryAbs * x1 * x1;
  const coef = sign * Math.sqrt(Math.max(0, numer / (denom || 1)));
  const cxp = coef * ((rxAbs * y1) / ryAbs);
  const cyp = coef * ((-ryAbs * x1) / rxAbs);
  const cx = cos * cxp - sin * cyp + (from.x + to.x) / 2;
  const cy = sin * cxp + cos * cyp + (from.y + to.y) / 2;
  const start = vectorAngle(1, 0, (x1 - cxp) / rxAbs, (y1 - cyp) / ryAbs);
  let delta = vectorAngle((x1 - cxp) / rxAbs, (y1 - cyp) / ryAbs, (-x1 - cxp) / rxAbs, (-y1 - cyp) / ryAbs);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(8, Math.ceil((Math.abs(delta) * Math.max(rxAbs, ryAbs)) / 12));
  const points: Array<{ x: number; y: number }> = [];
  for (let step = 1; step <= steps; step += 1) {
    const theta = start + (delta * step) / steps;
    const ex = rxAbs * Math.cos(theta);
    const ey = ryAbs * Math.sin(theta);
    points.push({ x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy });
  }
  return points;
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  let angle = Math.acos(Math.max(-1, Math.min(1, dot / (length || 1))));
  if (ux * vy - uy * vx < 0) angle = -angle;
  return angle;
}

function strokeDashed(
  data: Uint8Array,
  width: number,
  height: number,
  paths: readonly { d: string }[],
  grey: number,
): void {
  const dash = 4;
  const gap = 10;
  const period = dash + gap;
  for (const path of paths) {
    const points = parsePath(path.d).map((point) => ({
      x: scale(point.x, LESSON_WIDTH, width),
      y: scale(point.y, LESSON_HEIGHT, height),
    }));
    let cursor = 0;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      if (!from || !to) continue;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const steps = Math.max(1, Math.ceil(length));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const along = cursor + (length * step) / steps;
        if (along % period > dash) continue;
        paintDot(data, width, height, Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t), grey);
      }
      cursor += length;
    }
  }
}

function paintDot(data: Uint8Array, width: number, height: number, x: number, y: number, grey: number): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  data[offset] = grey;
  data[offset + 1] = grey;
  data[offset + 2] = grey;
  data[offset + 3] = 255;
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

function num(token: string | undefined): number {
  return token === undefined ? 0 : Number(token);
}
