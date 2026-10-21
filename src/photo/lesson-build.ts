/**
 * Contours become a lesson package: the main outline, then details, then colour.
 *
 * Grouping is geometric (bounding box, area, length, containment), not a claim
 * that the parts were recognised. Step 1 is the largest closed shape on its
 * own. Instructions start from a fixed Indonesian sentence and can be replaced
 * by the text model when it returns one line per step. See D-67.
 */

import { assertValidLessons } from '../lesson-data/validate';
import { LESSON_SCHEMA_VERSION, type ColorRegion, type GuidePath, type LessonPackage, type LessonPhase, type LessonStep } from '../lesson-data/schema';
import { nearestColor, sampleColor } from './colors';
import type { RgbaImage } from './png';
import type { Contour, Point } from './trace';

export const LESSON_WIDTH = 1000;
export const LESSON_HEIGHT = 750;
export const MAX_DRAWING_STEPS = 7;
export const MAX_PATHS_PER_STEP = 3;
export const MAX_COLOR_STEPS = 3;
/** Largest shape box / subject box. Below this, the parent is asked to look again. */
export const LOW_SUBJECT_COVERAGE = 0.35;

export interface StepBrief {
  readonly id: string;
  readonly phase: LessonPhase;
  readonly label: string;
  readonly position: string;
}

export interface BuiltLesson {
  readonly lesson: LessonPackage;
  readonly sourceContours: readonly MappedContour[];
  readonly briefs: readonly StepBrief[];
  readonly coverage: number;
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
}

export interface MappedContour {
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly area: number;
  readonly length: number;
  readonly cx: number;
  readonly cy: number;
  readonly nx: number;
  readonly ny: number;
}

export function buildPhotoLesson(input: {
  readonly id: string;
  readonly title: string;
  readonly targetHash: string;
  readonly contours: readonly Contour[];
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly photo: RgbaImage;
  readonly palette: readonly string[];
  readonly instructions?: ReadonlyMap<string, string>;
}): BuiltLesson {
  const mapped = input.contours
    .map((contour) => mapContour(contour, input.sourceWidth, input.sourceHeight))
    .filter((contour) => contour.points.length >= 4);
  if (mapped.length === 0) {
    throw new Error('No drawable shapes were found in the illustration');
  }
  const ranked = [...mapped].sort((left, right) => boxOf(right.points).area - boxOf(left.points).area || right.length - left.length || right.area - left.area);
  const main = ranked[0]!;
  const mainBox = boxOf(main.points);
  const withoutSpecks = ranked.filter((shape, index) => index === 0 || !isSpeck(shape, mainBox));
  const unique = dedupe(withoutSpecks);
  const keptMain = unique[0] ?? main;
  const others = unique.slice(1);
  const family = [keptMain, ...others];
  const parents = parentsOf(family);
  const details = others
    .map((shape, index) => ({ shape, contained: parents[index + 1] !== null }))
    .sort((left, right) => Number(left.contained) - Number(right.contained) || boxOf(right.shape.points).area - boxOf(left.shape.points).area || right.shape.length - left.shape.length)
    .map((item) => item.shape);
  const subject = unionBox(family.map((shape) => boxOf(shape.points)));
  const coverage = mainBox.area / Math.max(1, subject.area);
  const needsReview = coverage < LOW_SUBJECT_COVERAGE;
  const reviewReason = needsReview
    ? 'Bentuk terbesar hanya menutupi sebagian kecil subjek. Cek dulu sebelum dipakai.'
    : null;
  const colorShapes = pickColors(family);

  const steps: LessonStep[] = [];
  const briefs: StepBrief[] = [];
  const regions: ColorRegion[] = [];
  const preview: GuidePath[] = [];

  const outlineGuides = [guide('outline-1-1', keptMain)];
  preview.push(...outlineGuides);
  steps.push(lineStep('outline-1', 'outline', instruction(input.instructions, 'outline-1', 'outline', 0), outlineGuides));
  briefs.push(brief('outline-1', 'outline', keptMain, 0));

  spread(details).forEach((shapes, index) => {
    const id = `detail-${index + 1}`;
    const guides = shapes.map((shape, shapeIndex) => guide(`${id}-${shapeIndex + 1}`, shape));
    preview.push(...guides);
    steps.push(lineStep(id, 'detail', instruction(input.instructions, id, 'detail', index), guides));
    briefs.push(brief(id, 'detail', shapes[0]!, index));
  });
  colorShapes.forEach((shape, index) => {
    const id = `color-region-${index + 1}`;
    const stepId = `color-${index + 1}`;
    const sampled = sampleColor(input.photo, shape.nx, shape.ny);
    const color = nearestColor(sampled, input.palette);
    const position = positionOf(shape);
    regions.push({ id, label: `Wilayah ${position}`, d: pathData(shape.points, true), suggestedColor: color });
    steps.push({
      id: stepId,
      phase: 'color',
      instruction: instruction(input.instructions, stepId, 'color', index),
      guidePaths: [],
      colorRegionIds: [id],
      toolPreset: { tool: 'brush', color, widthViewbox: 28 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
    briefs.push({ id: stepId, phase: 'color', label: `wilayah warna ${position}`, position });
  });

  const lesson: LessonPackage = {
    id: input.id,
    schemaVersion: LESSON_SCHEMA_VERSION,
    contentVersion: `photo-${input.targetHash.slice(0, 12)}`,
    title: sanitizeTitle(input.title),
    subtitle: 'Dari foto',
    coordinateSpace: { width: LESSON_WIDTH, height: LESSON_HEIGHT },
    steps,
    colorRegions: regions,
    targetPreview: { paths: preview.length > 0 ? preview : [guide('preview', mapped[0]!)] },
  };
  assertValidLessons([lesson]);
  return { lesson, sourceContours: family, briefs, coverage, needsReview, reviewReason };
}

export function fallbackInstruction(phase: LessonPhase, index: number): string {
  if (phase === 'outline') {
    return index === 0 ? 'Gambar bentuk yang paling besar.' : 'Gambar bentuk besar berikutnya.';
  }
  if (phase === 'detail') return 'Tambahkan bagian kecil ini.';
  return 'Warnai bagian ini.';
}

export function sanitizeTitle(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2) return 'Dari foto';
  return cleaned.slice(0, 40);
}

function instruction(
  overrides: ReadonlyMap<string, string> | undefined,
  id: string,
  phase: LessonPhase,
  index: number,
): string {
  const custom = overrides?.get(id)?.trim();
  if (custom && custom.length >= 3 && custom.length <= 120 && !rejectsSubject(custom)) return custom;
  return fallbackInstruction(phase, index);
}

function rejectsSubject(text: string): boolean {
  return /latar belakang/i.test(text) || /wajah anak/i.test(text);
}

function lineStep(id: string, phase: 'outline' | 'detail', text: string, guides: readonly GuidePath[]): LessonStep {
  return {
    id,
    phase,
    instruction: text,
    guidePaths: guides,
    colorRegionIds: [],
    toolPreset: { tool: 'pen', color: '#3a3a3a', widthViewbox: 8 },
    completionPolicy: { manualAllowed: true, automaticEnabled: false },
  };
}

function guide(id: string, shape: MappedContour): GuidePath {
  return { id, d: pathData(shape.points, shape.closed), role: 'final-outline' };
}

function spread(details: readonly MappedContour[]): MappedContour[][] {
  const groups: MappedContour[][] = [];
  for (const shape of details) {
    if (groups.length < MAX_DRAWING_STEPS - 1) {
      groups.push([shape]);
      continue;
    }
    const room = groups.find((group) => group.length < MAX_PATHS_PER_STEP);
    if (room) room.push(shape);
  }
  return groups;
}

function pickColors(shapes: readonly MappedContour[]): MappedContour[] {
  const largest = shapes.reduce((max, shape) => Math.max(max, shape.area), 0);
  const floor = Math.max(400, largest * 0.08);
  const chosen: MappedContour[] = [];
  const sorted = [...shapes].sort((left, right) => right.area - left.area);
  for (const shape of sorted) {
    if (!shape.closed || shape.area < floor) continue;
    const box = boxOf(shape.points);
    if (chosen.some((other) => iou(box, boxOf(other.points)) >= 0.72)) continue;
    chosen.push(shape);
    if (chosen.length >= MAX_COLOR_STEPS) break;
  }
  return chosen;
}

function brief(id: string, phase: 'outline' | 'detail', shape: MappedContour, index: number): StepBrief {
  const position = positionOf(shape);
  const label = phase === 'outline'
    ? (index === 0 ? 'garis besar subjek' : 'bentuk besar lain')
    : `detail ${position}`;
  return { id, phase, label, position };
}

function positionOf(shape: MappedContour): string {
  let x = 'tengah';
  if (shape.cx < 400) x = 'kiri';
  else if (shape.cx > 600) x = 'kanan';
  let y = 'tengah';
  if (shape.cy < 300) y = 'atas';
  else if (shape.cy > 450) y = 'bawah';
  if (x === 'tengah' && y === 'tengah') return 'tengah';
  if (x === 'tengah') return y;
  if (y === 'tengah') return x;
  return `${y} ${x}`;
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly area: number;
}

function boxOf(points: readonly Point[]): Box {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, area: Math.max(0, maxX - minX) * Math.max(0, maxY - minY) };
}

function unionBox(boxes: readonly Box[]): Box {
  const seed = boxes[0] ?? { minX: 0, minY: 0, maxX: 0, maxY: 0, area: 0 };
  const merged = boxes.reduce((box, next) => ({
    minX: Math.min(box.minX, next.minX),
    minY: Math.min(box.minY, next.minY),
    maxX: Math.max(box.maxX, next.maxX),
    maxY: Math.max(box.maxY, next.maxY),
    area: 0,
  }), seed);
  return { ...merged, area: Math.max(0, merged.maxX - merged.minX) * Math.max(0, merged.maxY - merged.minY) };
}

function iou(left: Box, right: Box): number {
  const width = Math.max(0, Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX));
  const height = Math.max(0, Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY));
  const intersection = width * height;
  const union = left.area + right.area - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function isSpeck(shape: MappedContour, mainBox: Box): boolean {
  const box = boxOf(shape.points);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const mainSpan = Math.max(1, Math.max(mainBox.maxX - mainBox.minX, mainBox.maxY - mainBox.minY));
  if (span < 18 && box.area < 250) return true;
  return span < mainSpan * 0.04 && box.area < mainBox.area * 0.005;
}

function dedupe(shapes: readonly MappedContour[]): MappedContour[] {
  const kept: MappedContour[] = [];
  for (const shape of shapes) {
    const box = boxOf(shape.points);
    const duplicate = kept.some((other) => {
      const ratio = shape.length / Math.max(1, other.length);
      return iou(box, boxOf(other.points)) >= 0.82 && ratio > 0.75 && ratio < 1.34;
    });
    if (!duplicate) kept.push(shape);
  }
  return kept;
}

function mapContour(contour: Contour, sourceWidth: number, sourceHeight: number): MappedContour {
  const pad = 48;
  const scale = Math.min((LESSON_WIDTH - pad * 2) / sourceWidth, (LESSON_HEIGHT - pad * 2) / sourceHeight);
  const offsetX = (LESSON_WIDTH - sourceWidth * scale) / 2;
  const offsetY = (LESSON_HEIGHT - sourceHeight * scale) / 2;
  const points = contour.points.map((point) => ({
    x: round(offsetX + point.x * scale),
    y: round(offsetY + point.y * scale),
  }));
  const area = Math.abs(shoelace(points));
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index]!.x - points[index - 1]!.x, points[index]!.y - points[index - 1]!.y);
  }
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const source = contour.points;
  const sx = source.reduce((sum, point) => sum + point.x, 0) / source.length;
  const sy = source.reduce((sum, point) => sum + point.y, 0) / source.length;
  return {
    points,
    closed: contour.closed,
    area,
    length,
    cx,
    cy,
    nx: sourceWidth <= 1 ? 0 : sx / (sourceWidth - 1),
    ny: sourceHeight <= 1 ? 0 : sy / (sourceHeight - 1),
  };
}

function parentsOf(shapes: readonly MappedContour[]): Array<number | null> {
  return shapes.map((shape, index) => {
    let parent: number | null = null;
    let parentArea = Number.POSITIVE_INFINITY;
    for (let other = 0; other < shapes.length; other += 1) {
      if (other === index) continue;
      const candidate = shapes[other]!;
      if (!candidate.closed || candidate.area <= shape.area) continue;
      if (candidate.area < parentArea && pointInPolygon(shape.cx, shape.cy, candidate.points)) {
        parent = other;
        parentArea = candidate.area;
      }
    }
    return parent;
  });
}

function pointInPolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]!;
    const b = points[j]!;
    const intersect = ((a.y > y) !== (b.y > y))
      && (x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

function shoelace(points: readonly Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length]!;
    const current = points[index]!;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function pathData(points: readonly Point[], closed: boolean): string {
  const head = points[0];
  if (!head) return 'M 0 0';
  const commands = [`M ${head.x} ${head.y}`];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]!;
    commands.push(`L ${point.x} ${point.y}`);
  }
  if (closed) commands.push('Z');
  return commands.join(' ');
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
