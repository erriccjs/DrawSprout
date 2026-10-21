/**
 * Turn traced contours into a catalogue-style lesson: one basic shape per
 * step, pairs together, then one colour step per distinct colour of the
 * object. The step count follows the real parts. See D-68.
 */

import { assertValidLessons } from '../lesson-data/validate';
import { LESSON_SCHEMA_VERSION, type ColorRegion, type GuidePath, type LessonPackage, type LessonStep } from '../lesson-data/schema';
import { rgbDistance, rgbToHex, sampleRegionRgb, type Rgb } from './colors';
import type { RgbaImage } from './png';
import {
  LESSON_HEIGHT,
  LESSON_WIDTH,
  LOW_SUBJECT_COVERAGE,
  MAX_PATHS_PER_STEP,
  cleanPartName,
  planShapes,
  shapeInstruction,
  shouldRedraw,
  type MappedContour,
  type PlannedPart,
  type ShapeProposal,
  type ShapeTarget,
} from './shapes';
import type { Contour, Point } from './trace';

export { LESSON_HEIGHT, LESSON_WIDTH, LOW_SUBJECT_COVERAGE, MAX_PATHS_PER_STEP, shouldRedraw };
export type { ShapeProposal, ShapeTarget };

export interface BuiltLesson {
  readonly lesson: LessonPackage;
  readonly sourceContours: readonly MappedContour[];
  readonly targets: readonly ShapeTarget[];
  /** Largest single shape box / subject box. */
  readonly coverage: number;
  /** Union of the fitted shapes / subject box. A low value asks for another drawing. */
  readonly subjectFit: number;
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
}

export function buildPhotoLesson(input: {
  readonly id: string;
  readonly title: string;
  readonly targetHash: string;
  readonly contours: readonly Contour[];
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly photo: RgbaImage;
  /** Kept for callers. Colour steps sample the photo, they do not use this list. */
  readonly palette: readonly string[];
  readonly proposals?: readonly ShapeProposal[];
}): BuiltLesson {
  const mapped = input.contours
    .map((contour) => mapContour(contour, input.sourceWidth, input.sourceHeight))
    .filter((contour) => contour.points.length >= 3);
  if (mapped.length === 0) throw new Error('No drawable shapes were found in the illustration');
  const plan = planShapes(mapped, input.proposals);
  if (plan.parts.length === 0) throw new Error('No drawable shapes were found in the illustration');

  const steps: LessonStep[] = [];
  const preview: GuidePath[] = [];
  plan.parts.forEach((part, index) => {
    const id = index === 0 ? 'outline-1' : `detail-${index}`;
    const guides = part.paths.slice(0, MAX_PATHS_PER_STEP).map((path, pathIndex) => ({
      id: `${id}-${pathIndex + 1}`,
      d: path,
      role: 'final-outline' as const,
    }));
    preview.push(...guides);
    steps.push({
      id,
      phase: index === 0 ? 'outline' : 'detail',
      instruction: shapeInstruction(part.kind, part.name, part.pair, index === 0 && !part.pair),
      guidePaths: guides,
      colorRegionIds: [],
      toolPreset: { tool: 'pen', color: '#3a3a3a', widthViewbox: 8 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
  });

  const regions: ColorRegion[] = [];
  colourGroups(plan.parts, input.photo).forEach((group, index) => {
    const id = `color-${index + 1}`;
    const regionIds: string[] = [];
    const seen = new Set<string>();
    group.items.forEach((item, itemIndex) => {
      if (seen.has(item.path)) return;
      seen.add(item.path);
      const regionId = `${id}-${itemIndex + 1}`;
      regionIds.push(regionId);
      regions.push({
        id: regionId,
        label: item.name,
        d: item.path,
        suggestedColor: rgbToHex(group.rgb),
      });
    });
    if (regionIds.length === 0) return;
    steps.push({
      id,
      phase: 'color',
      instruction: colourInstruction(group.items.map((item) => item.name)),
      guidePaths: [],
      colorRegionIds: regionIds,
      toolPreset: { tool: 'brush', color: rgbToHex(group.rgb), widthViewbox: 28 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
  });

  const needsReview = plan.subjectFit < LOW_SUBJECT_COVERAGE;
  const lesson: LessonPackage = {
    id: input.id,
    schemaVersion: LESSON_SCHEMA_VERSION,
    contentVersion: `photo-${input.targetHash.slice(0, 12)}`,
    title: sanitizeTitle(input.title),
    subtitle: 'Dari foto',
    coordinateSpace: { width: LESSON_WIDTH, height: LESSON_HEIGHT },
    steps: uniquify(steps),
    colorRegions: regions,
    targetPreview: { paths: preview.length > 0 ? preview : [fallbackPreview(mapped)] },
  };
  assertValidLessons([lesson]);
  return {
    lesson,
    sourceContours: mapped,
    targets: plan.targets,
    coverage: plan.coverage,
    subjectFit: plan.subjectFit,
    needsReview,
    reviewReason: needsReview
      ? 'Bentuk yang digambar hanya menutupi sebagian kecil subjek. Cek dulu sebelum dipakai.'
      : null,
  };
}

export function sanitizeTitle(raw: string): string {
  const cleaned = raw.replace(/[^\p{L}\p{N} '-]/gu, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2 || /latar belakang|wajah anak/i.test(cleaned)) return 'Dari foto';
  return cleaned.slice(0, 40);
}

export function fixVerb(text: string): string {
  return text.replace(/\bWarna\b/gi, 'Warnai');
}

export function normalizeInstruction(text: string): string {
  return text.toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
}

interface Swatch {
  readonly name: string;
  readonly path: string;
  readonly area: number;
  readonly rgb: Rgb;
}

interface ColourCluster {
  rgb: Rgb;
  items: Swatch[];
}

function colourGroups(parts: readonly PlannedPart[], photo: RgbaImage): ColourCluster[] {
  const swatches: Swatch[] = [];
  for (const part of parts) {
    if (part.kind === 'line') continue;
    for (const place of part.places) {
      const rgb = sampleRegionRgb(photo, place.nx, place.ny);
      if (!rgb) continue;
      swatches.push({ name: part.name, path: place.path, area: place.area, rgb });
    }
  }
  const clusters: ColourCluster[] = [];
  for (const swatch of swatches) {
    let bestIndex = -1;
    let bestDistance = 48;
    clusters.forEach((cluster, index) => {
      const distance = rgbDistance(cluster.rgb, swatch.rgb);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    });
    const existing = bestIndex >= 0 ? clusters[bestIndex] : undefined;
    if (existing) {
      existing.items.push(swatch);
      existing.rgb = averageRgb(existing.items);
    } else {
      clusters.push({ rgb: swatch.rgb, items: [swatch] });
    }
  }
  return mergeTiny(clusters).sort((left, right) => areaOf(right) - areaOf(left));
}

function mergeTiny(clusters: ColourCluster[]): ColourCluster[] {
  const largest = clusters.reduce((max, cluster) => Math.max(max, areaOf(cluster)), 0);
  const dropped = new Set<number>();
  clusters.forEach((cluster, index) => {
    const area = areaOf(cluster);
    if (largest <= 0 || area >= largest * 0.06) return;
    let nearest = -1;
    let distance = Number.POSITIVE_INFINITY;
    clusters.forEach((other, otherIndex) => {
      if (otherIndex === index || dropped.has(otherIndex) || areaOf(other) < area) return;
      const gap = rgbDistance(cluster.rgb, other.rgb);
      if (gap < distance) {
        distance = gap;
        nearest = otherIndex;
      }
    });
    const target = nearest >= 0 ? clusters[nearest] : undefined;
    if (target && distance < 100) {
      target.items.push(...cluster.items);
      target.rgb = averageRgb(target.items);
      dropped.add(index);
      return;
    }
    if (area < largest * 0.025) dropped.add(index);
  });
  return clusters.filter((_, index) => !dropped.has(index));
}

function areaOf(cluster: ColourCluster): number {
  return cluster.items.reduce((sum, item) => sum + item.area, 0);
}

function averageRgb(items: readonly Swatch[]): Rgb {
  const count = Math.max(1, items.length);
  return {
    r: items.reduce((sum, item) => sum + item.rgb.r, 0) / count,
    g: items.reduce((sum, item) => sum + item.rgb.g, 0) / count,
    b: items.reduce((sum, item) => sum + item.rgb.b, 0) / count,
  };
}

function colourInstruction(names: readonly string[]): string {
  const unique: string[] = [];
  for (const name of names) {
    const cleaned = cleanPartName(name, '');
    if (cleaned.length < 2 || unique.includes(cleaned)) continue;
    unique.push(cleaned);
    if (unique.length === 3) break;
  }
  const first = unique[0];
  const second = unique[1];
  const third = unique[2];
  if (!first) return 'Warnai bagian ini.';
  if (!second) return `Warnai ${first}.`;
  if (!third) return `Warnai ${first} dan ${second}.`;
  return `Warnai ${first}, ${second}, dan ${third}.`;
}

function uniquify(steps: LessonStep[]): LessonStep[] {
  const used = new Set<string>();
  return steps.map((step) => {
    const base = fixVerb(step.instruction);
    let text = base;
    let key = normalizeInstruction(text);
    let extra = 2;
    while (used.has(key)) {
      const suffix = extra === 2 ? ' yang lain' : ` (${extra})`;
      text = `${base.replace(/\.$/, '')}${suffix}.`;
      extra += 1;
      key = normalizeInstruction(text);
    }
    used.add(key);
    return text === step.instruction ? step : { ...step, instruction: text };
  });
}

function fallbackPreview(contours: readonly MappedContour[]): GuidePath {
  const first = contours[0];
  const point = first?.points[0] ?? { x: 0, y: 0 };
  return { id: 'preview', d: `M ${point.x} ${point.y}`, role: 'final-outline' };
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
  const source = contour.points;
  const sx = source.reduce((sum, point) => sum + point.x, 0) / Math.max(1, source.length);
  const sy = source.reduce((sum, point) => sum + point.y, 0) / Math.max(1, source.length);
  return {
    points,
    closed: contour.closed,
    area: Math.abs(shoelace(points)),
    length: polylineLength(points),
    cx: points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length),
    cy: points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, points.length),
    nx: sourceWidth <= 1 ? 0 : sx / (sourceWidth - 1),
    ny: sourceHeight <= 1 ? 0 : sy / (sourceHeight - 1),
    silhouette: contour.silhouette === true,
  };
}

function polylineLength(points: readonly Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return length;
}

function shoelace(points: readonly Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
