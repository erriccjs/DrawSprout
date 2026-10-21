/**
 * Contours become a lesson package: big shapes, then details, then colour.
 *
 * Grouping is geometric (area, length, containment), not a claim that the
 * parts were recognised. Instructions start from a fixed Indonesian sentence
 * and can be replaced by the text model when it returns one line per step.
 */

import { assertValidLessons } from '../lesson-data/validate';
import { LESSON_SCHEMA_VERSION, type ColorRegion, type GuidePath, type LessonPackage, type LessonPhase, type LessonStep } from '../lesson-data/schema';
import { nearestColor, sampleColor } from './colors';
import type { RgbaImage } from './png';
import type { Contour, Point } from './trace';

export const LESSON_WIDTH = 1000;
export const LESSON_HEIGHT = 750;

export interface BuiltLesson {
  readonly lesson: LessonPackage;
  readonly sourceContours: readonly MappedContour[];
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
    .filter((contour) => contour.area > 80 || contour.length > 40)
    .sort((left, right) => right.area - left.area)
    .slice(0, 16);
  if (mapped.length === 0) {
    throw new Error('No drawable shapes were found in the illustration');
  }
  const parents = parentsOf(mapped);
  const outers = mapped.filter((_, index) => parents[index] === null);
  const details = mapped.filter((_, index) => parents[index] !== null);
  const outlineGroups = group(outers.length > 0 ? outers : mapped.slice(0, 1), 3);
  const detailGroups = group(details, 2);
  const colorShapes = mapped.filter((shape) => shape.closed && shape.area > 400).slice(0, 6);

  const steps: LessonStep[] = [];
  const regions: ColorRegion[] = [];
  const preview: GuidePath[] = [];

  outlineGroups.forEach((shapes, index) => {
    const guides = shapes.map((shape, shapeIndex) => guide(`outline-${index + 1}-${shapeIndex + 1}`, shape));
    preview.push(...guides);
    steps.push(lineStep(`outline-${index + 1}`, 'outline', instruction(input.instructions, `outline-${index + 1}`, 'outline', index), guides));
  });
  detailGroups.forEach((shapes, index) => {
    const guides = shapes.map((shape, shapeIndex) => guide(`detail-${index + 1}-${shapeIndex + 1}`, shape));
    preview.push(...guides);
    steps.push(lineStep(`detail-${index + 1}`, 'detail', instruction(input.instructions, `detail-${index + 1}`, 'detail', index), guides));
  });
  colorShapes.forEach((shape, index) => {
    const id = `color-region-${index + 1}`;
    const sampled = sampleColor(input.photo, shape.nx, shape.ny);
    const color = nearestColor(sampled, input.palette);
    regions.push({ id, label: `Bagian ${index + 1}`, d: pathData(shape.points, true), suggestedColor: color });
    steps.push({
      id: `color-${index + 1}`,
      phase: 'color',
      instruction: instruction(input.instructions, `color-${index + 1}`, 'color', index),
      guidePaths: [],
      colorRegionIds: [id],
      toolPreset: { tool: 'brush', color, widthViewbox: 28 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
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
  return { lesson, sourceContours: mapped };
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
  if (custom && custom.length >= 3 && custom.length <= 120) return custom;
  return fallbackInstruction(phase, index);
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

function group<T>(items: readonly T[], maxGroups: number): T[][] {
  if (items.length === 0 || maxGroups <= 0) return [];
  if (items.length <= maxGroups) return items.map((item) => [item]);
  const groups: T[][] = [];
  const size = Math.ceil(items.length / maxGroups);
  for (let index = 0; index < items.length; index += size) groups.push([...items.slice(index, index + size)]);
  return groups;
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
