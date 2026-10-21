/**
 * Traced lines become a lesson. A named part keeps its real outline.
 *
 * A circle or oval is added first only when it fits that outline. When the
 * vision model names nothing usable, the lesson falls back to the traced
 * builder from a19f6f9 (largest closed contour, then details). See D-70.
 */

import { assertValidLessons } from '../lesson-data/validate';
import { LESSON_SCHEMA_VERSION, type ColorRegion, type GuidePath, type LessonPackage, type LessonStep } from '../lesson-data/schema';
import { colourHex, indonesianColourName, knownColourName, rgbToHex, sampleRegionRgb, type Rgb } from './colors';
import { cleanPartName, type DetectedPart } from './parts';
import type { RgbaImage } from './png';
import type { Contour, Point } from './trace';

export const LESSON_WIDTH = 1000;
export const LESSON_HEIGHT = 750;
/** Largest closed outline / subject box. Below this, the drawing is asked for again. */
export const OUTLINE_COVERAGE_MIN = 0.6;
/** Filled overlap required before a circle or oval may introduce a part. */
export const CONSTRUCTION_IOU_MIN = 0.8;
const MAX_FALLBACK_DRAWING_STEPS = 7;
const MAX_FALLBACK_PATHS = 3;
const MAX_FALLBACK_COLORS = 3;

export interface BuiltLesson {
  readonly lesson: LessonPackage;
  readonly coverage: number;
  /** Same figure as `coverage`: outline box / subject box. */
  readonly subjectFit: number;
  readonly builder: 'parts' | 'traced';
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
}

export function outlineCoverage(contours: readonly Contour[]): number {
  const usable = contours.filter((contour) => contour.points.length >= 2);
  if (usable.length === 0) return 0;
  const boxes = usable.map((contour) => boxOf(contour.points));
  const subject = unionBox(boxes);
  const main = mainOf(usable);
  return boxOf(main.points).area / Math.max(1, subject.area);
}

export function shouldRedraw(coverage: number): boolean {
  return coverage < OUTLINE_COVERAGE_MIN;
}

export function buildPhotoLesson(input: {
  readonly id: string;
  readonly title: string;
  readonly targetHash: string;
  readonly contours: readonly Contour[];
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly photo: RgbaImage;
  /** Used by the traced fallback when a sample has no colour of its own. */
  readonly palette: readonly string[];
  readonly parts?: readonly DetectedPart[];
}): BuiltLesson {
  const mapped = input.contours
    .map((contour) => mapContour(contour, input.sourceWidth, input.sourceHeight))
    .filter((contour) => contour.points.length >= 3);
  if (mapped.length === 0) throw new Error('No drawable shapes were found in the illustration');
  const named = buildFromParts(input, mapped);
  if (named) return named;
  return buildTracedFallback(input, mapped);
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

interface MappedContour {
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly area: number;
  readonly length: number;
  readonly cx: number;
  readonly cy: number;
  readonly nx: number;
  readonly ny: number;
  readonly silhouette: boolean;
  readonly path: string;
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly area: number;
}

function buildFromParts(input: {
  readonly id: string;
  readonly title: string;
  readonly targetHash: string;
  readonly photo: RgbaImage;
  readonly parts?: readonly DetectedPart[];
}, mapped: readonly MappedContour[]): BuiltLesson | null {
  const parts = (input.parts ?? []).filter((part) => cleanPartName(part.name) === part.name);
  if (parts.length === 0) return null;
  const main = pickMain(mapped);
  const subject = unionBox(mapped.map((contour) => boxOf(contour.points)));
  const coverage = boxOf(main.points).area / Math.max(1, subject.area);
  const kept = mapped.filter((contour) => contour === main || !isSpeck(contour, boxOf(main.points)));
  const groups = new Map<DetectedPart, MappedContour[]>();
  for (const contour of kept) {
    const part = ownerOf(contour, parts);
    if (!part) continue;
    const list = groups.get(part) ?? [];
    list.push(contour);
    groups.set(part, list);
  }
  if (groups.size === 0) return null;

  const steps: LessonStep[] = [];
  const preview: GuidePath[] = [];
  const outlinePart = ownerOf(main, parts);
  const outlineName = outlinePart?.name;
  if (!outlineName) return null;
  const fit = constructionOf(main.points);
  if (fit) {
    const id = 'construct-1';
    const guide: GuidePath = { id: `${id}-1`, d: fit.d, role: 'construction' };
    steps.push(lineStep(id, 'outline', constructionInstruction(fit.kind, outlineName), [guide]));
  }
  const outlineInks = uniqueContours(outlinePart ? (groups.get(outlinePart) ?? [main]) : [main]);
  if (!outlineInks.includes(main)) outlineInks.unshift(main);
  const outlineGuides = guidesFor('outline-1', outlineInks);
  preview.push(...outlineGuides);
  const outlinePair = outlinePart?.pair === true && outlineInks.length > 1;
  steps.push(lineStep(
    'outline-1',
    'outline',
    outlinePair ? `Tambahkan dua ${outlineName}.` : `Gambar garis luar ${outlineName}.`,
    outlineGuides,
  ));

  const details = [...groups.entries()]
    .filter(([part]) => part !== outlinePart)
    .sort((left, right) => areaOf(right[0]) - areaOf(left[0]));
  details.forEach(([part, contours], index) => {
    const id = `detail-${index + 1}`;
    const inks = uniqueContours(contours);
    if (inks.length === 0) return;
    const guides = guidesFor(id, inks);
    preview.push(...guides);
    const pair = part.pair || inks.length > 1 && mirrored(inks);
    steps.push(lineStep(id, 'detail', pair ? `Tambahkan dua ${part.name}.` : `Gambar ${part.name}.`, guides));
  });
  if (steps.every((step) => step.phase === 'color')) return null;

  const regions: ColorRegion[] = [];
  colourGroups([...groups.entries()], input.photo).forEach((group, index) => {
    const id = `color-${index + 1}`;
    const regionIds: string[] = [];
    group.paths.forEach((path, pathIndex) => {
      const regionId = `${id}-${pathIndex + 1}`;
      regionIds.push(regionId);
      regions.push({ id: regionId, label: group.names[pathIndex] ?? group.names[0] ?? group.colour, d: path, suggestedColor: group.hex });
    });
    if (regionIds.length === 0) return;
    steps.push({
      id,
      phase: 'color',
      instruction: colourInstruction(group.names, group.colour),
      guidePaths: [],
      colorRegionIds: regionIds,
      toolPreset: { tool: 'brush', color: group.hex, widthViewbox: 28 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
  });

  return finish(input, steps, regions, preview, mapped, coverage, 'parts');
}

function buildTracedFallback(input: {
  readonly id: string;
  readonly title: string;
  readonly targetHash: string;
  readonly photo: RgbaImage;
}, mapped: readonly MappedContour[]): BuiltLesson {
  const main = pickMain(mapped);
  const mainBox = boxOf(main.points);
  const unique = [main, ...dedupe(mapped.filter((shape) => shape !== main && !isSpeck(shape, mainBox)))];
  const subject = unionBox(mapped.map((shape) => boxOf(shape.points)));
  const coverage = mainBox.area / Math.max(1, subject.area);
  const steps: LessonStep[] = [];
  const preview: GuidePath[] = [];
  const regions: ColorRegion[] = [];
  const outline = guidesFor('outline-1', [main]);
  preview.push(...outline);
  steps.push(lineStep('outline-1', 'outline', 'Gambar bentuk yang paling besar.', outline));
  const groups: MappedContour[][] = [];
  for (const shape of unique.slice(1)) {
    if (groups.length < MAX_FALLBACK_DRAWING_STEPS - 1) {
      groups.push([shape]);
      continue;
    }
    const room = groups.find((group) => group.length < MAX_FALLBACK_PATHS);
    if (room) room.push(shape);
  }
  groups.forEach((shapes, index) => {
    const id = `detail-${index + 1}`;
    const guides = guidesFor(id, shapes);
    preview.push(...guides);
    steps.push(lineStep(id, 'detail', 'Tambahkan bagian kecil ini.', guides));
  });
  fallbackColours(unique, input.photo).forEach((entry, index) => {
    const regionId = `color-region-${index + 1}`;
    regions.push({ id: regionId, label: entry.colour, d: entry.path, suggestedColor: entry.hex });
    steps.push({
      id: `color-${index + 1}`,
      phase: 'color',
      instruction: `Warnai dengan ${entry.colour}.`,
      guidePaths: [],
      colorRegionIds: [regionId],
      toolPreset: { tool: 'brush', color: entry.hex, widthViewbox: 28 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
  });
  return finish(input, steps, regions, preview, unique, coverage, 'traced');
}

function finish(
  input: { readonly id: string; readonly title: string; readonly targetHash: string },
  steps: LessonStep[],
  regions: ColorRegion[],
  preview: GuidePath[],
  mapped: readonly MappedContour[],
  coverage: number,
  builder: 'parts' | 'traced',
): BuiltLesson {
  const needsReview = coverage < OUTLINE_COVERAGE_MIN;
  const lesson: LessonPackage = {
    id: input.id,
    schemaVersion: LESSON_SCHEMA_VERSION,
    contentVersion: `photo-${input.targetHash.slice(0, 12)}`,
    title: sanitizeTitle(input.title),
    subtitle: 'Dari foto',
    coordinateSpace: { width: LESSON_WIDTH, height: LESSON_HEIGHT },
    steps: uniquify(steps),
    colorRegions: regions,
    targetPreview: { paths: preview.length > 0 ? preview : [guidesFor('preview', mapped.slice(0, 1))[0] ?? { id: 'preview', d: 'M 0 0', role: 'final-outline' }] },
  };
  assertValidLessons([lesson]);
  return {
    lesson,
    coverage,
    subjectFit: coverage,
    builder,
    needsReview,
    reviewReason: needsReview ? 'Garis luar hanya menutupi sebagian subjek. Cek dulu sebelum dipakai.' : null,
  };
}

interface ColourGroup {
  readonly colour: string;
  readonly hex: string;
  readonly names: string[];
  readonly paths: string[];
}

function colourGroups(entries: ReadonlyArray<readonly [DetectedPart, readonly MappedContour[]]>, photo: RgbaImage): ColourGroup[] {
  const groups = new Map<string, { hexes: Rgb[]; names: string[]; paths: string[] }>();
  for (const [part, contours] of entries) {
    const nx = (part.x + part.width / 2) / LESSON_WIDTH;
    const ny = (part.y + part.height / 2) / LESSON_HEIGHT;
    const rgb = sampleRegionRgb(photo, nx, ny);
    const sampled = rgb ? indonesianColourName(rgb) : '';
    const named = knownColourName(part.colorName) ?? '';
    const colour = named && (!sampled || named === sampled) ? named : (sampled || named);
    if (!colour) continue;
    const closed = contours.filter((contour) => contour.closed);
    const paths = (closed.length > 0 ? closed : contours).map((contour) => contour.path);
    if (paths.length === 0) paths.push(part.points.length >= 3 ? smoothPath(part.points, true) : rectPath(part));
    const group = groups.get(colour) ?? { hexes: [], names: [], paths: [] };
    if (rgb) group.hexes.push(rgb);
    if (!group.names.includes(part.name)) group.names.push(part.name);
    group.paths.push(...paths);
    groups.set(colour, group);
  }
  return [...groups.entries()].map(([colour, group]) => ({
    colour,
    hex: group.hexes.length > 0 ? rgbToHex(average(group.hexes)) : colourHex(colour),
    names: group.names,
    paths: group.paths,
  }));
}

function fallbackColours(
  shapes: readonly MappedContour[],
  photo: RgbaImage,
): Array<{ colour: string; hex: string; path: string }> {
  const largest = shapes.reduce((max, shape) => Math.max(max, shape.area), 0);
  const floor = Math.max(400, largest * 0.08);
  const chosen: Array<{ colour: string; hex: string; path: string }> = [];
  for (const shape of [...shapes].sort((left, right) => right.area - left.area)) {
    if (!shape.closed || shape.area < floor) continue;
    const rgb = sampleRegionRgb(photo, shape.nx, shape.ny);
    if (!rgb) continue;
    const colour = indonesianColourName(rgb);
    const hex = rgbToHex(rgb);
    if (chosen.some((other) => other.colour === colour)) continue;
    chosen.push({ colour, hex, path: shape.path });
    if (chosen.length >= MAX_FALLBACK_COLORS) break;
  }
  return chosen;
}

function constructionInstruction(kind: 'circle' | 'ellipse', name: string): string {
  const word = kind === 'circle' ? 'lingkaran' : 'oval';
  return `Gambar ${word} sebagai bentuk dasar untuk ${name}.`;
}

function colourInstruction(names: readonly string[], colour: string): string {
  const unique = names.filter((name, index) => names.indexOf(name) === index).slice(0, 3);
  const first = unique[0];
  const second = unique[1];
  const third = unique[2];
  if (!first) return `Warnai dengan ${colour}.`;
  if (!second) return `Warnai ${first} dengan ${colour}.`;
  if (!third) return `Warnai ${first} dan ${second} dengan ${colour}.`;
  return `Warnai ${first}, ${second}, dan ${third} dengan ${colour}.`;
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

function guidesFor(id: string, contours: readonly MappedContour[]): GuidePath[] {
  return contours.map((contour, index) => ({
    id: `${id}-${index + 1}`,
    d: contour.path,
    role: 'final-outline' as const,
  }));
}

function uniquify(steps: LessonStep[]): LessonStep[] {
  const used = new Set<string>();
  return steps.map((step) => {
    const base = fixVerb(step.instruction);
    let text = base;
    let key = normalizeInstruction(text);
    let extra = 0;
    while (used.has(key)) {
      extra += 1;
      const suffix = extra === 1 ? ' yang lain' : ' lagi';
      text = `${base.replace(/\.$/, '')}${suffix}.`;
      key = normalizeInstruction(text);
    }
    used.add(key);
    return text === step.instruction ? step : { ...step, instruction: text };
  });
}

function ownerOf(contour: MappedContour, parts: readonly DetectedPart[]): DetectedPart | null {
  let best: DetectedPart | null = null;
  let bestScore = 0.4;
  for (const part of parts) {
    const score = containment(contour, part);
    if (score > bestScore) {
      best = part;
      bestScore = score;
    }
  }
  return best;
}

function containment(contour: MappedContour, part: DetectedPart): number {
  const polygon = part.points.length >= 3 ? part.points : rectPoints(part);
  let inside = 0;
  for (const point of contour.points) {
    if (pointInPolygon(point.x, point.y, polygon)) inside += 1;
  }
  return inside / Math.max(1, contour.points.length);
}

function rectPoints(part: DetectedPart): Point[] {
  return [
    { x: part.x, y: part.y },
    { x: part.x + part.width, y: part.y },
    { x: part.x + part.width, y: part.y + part.height },
    { x: part.x, y: part.y + part.height },
  ];
}

function rectPath(part: DetectedPart): string {
  const points = rectPoints(part);
  return smoothPath(points, true);
}

function areaOf(part: DetectedPart): number {
  return Math.max(0, part.width) * Math.max(0, part.height);
}

function uniqueContours(contours: readonly MappedContour[]): MappedContour[] {
  const kept: MappedContour[] = [];
  for (const contour of contours) {
    if (!kept.includes(contour)) kept.push(contour);
  }
  return kept;
}

function mirrored(contours: readonly MappedContour[]): boolean {
  if (contours.length !== 2) return false;
  const left = contours[0];
  const right = contours[1];
  if (!left || !right) return false;
  const ratio = left.area / Math.max(1, right.area);
  return ratio > 0.55 && ratio < 1.82 && Math.abs(left.cy - right.cy) < 80 && Math.abs(left.cx - right.cx) > 40;
}

function pickMain(contours: readonly MappedContour[]): MappedContour {
  const silhouette = contours.find((contour) => contour.silhouette && contour.closed);
  if (silhouette) return silhouette;
  return mainOf(contours);
}

function mainOf<T extends { readonly points: readonly Point[]; readonly closed: boolean }>(contours: readonly T[]): T {
  const closed = contours.filter((contour) => contour.closed && contour.points.length >= 3);
  const pool = closed.length > 0 ? closed : contours;
  return pool.reduce((best, contour) => (boxOf(contour.points).area > boxOf(best.points).area ? contour : best));
}

function constructionOf(points: readonly Point[]): { kind: 'circle' | 'ellipse'; d: string } | null {
  const box = boxOf(points);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width < 12 || height < 12) return null;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const ellipseScore = filledIou(points, box, false);
  const circleScore = filledIou(points, box, true);
  if (circleScore >= ellipseScore && circleScore >= CONSTRUCTION_IOU_MIN) {
    const radius = Math.min(width, height) / 2;
    return { kind: 'circle', d: ellipsePath(cx, cy, radius, radius) };
  }
  if (ellipseScore >= CONSTRUCTION_IOU_MIN && (width / height > 1.15 || height / width > 1.15)) {
    return { kind: 'ellipse', d: ellipsePath(cx, cy, width / 2, height / 2) };
  }
  if (ellipseScore >= CONSTRUCTION_IOU_MIN && circleScore >= CONSTRUCTION_IOU_MIN) {
    const radius = (width + height) / 4;
    return { kind: 'circle', d: ellipsePath(cx, cy, radius, radius) };
  }
  return null;
}

function filledIou(points: readonly Point[], box: Box, circle: boolean): number {
  const size = 36;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const rx = circle ? Math.min(width, height) / 2 : width / 2;
  const ry = circle ? rx : height / 2;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = box.minX + ((x + 0.5) / size) * width;
      const py = box.minY + ((y + 0.5) / size) * height;
      const inPoly = pointInPolygon(px, py, points);
      const inPrim = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
      if (inPoly || inPrim) union += 1;
      if (inPoly && inPrim) intersection += 1;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const leftX = cx - rx;
  const rightX = cx + rx;
  return `M ${n(leftX)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 1 ${n(rightX)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 1 ${n(leftX)} ${n(cy)} Z`;
}

function smoothPath(points: readonly Point[], closed: boolean): string {
  const ring = closed ? openRing(points) : dedupePoints(points);
  if (ring.length === 0) return 'M 0 0';
  const first = ring[0] ?? { x: 0, y: 0 };
  if (ring.length === 1) return `M ${n(first.x)} ${n(first.y)}`;
  const simplified = rdp(ring, Math.max(3, diagonal(ring) * 0.012));
  const used = simplified.length >= 2 ? simplified : ring;
  if (used.length <= 8 && mostlyCorners(used)) return polyline(used, closed);
  return curves(used, closed);
}

function curves(points: readonly Point[], closed: boolean): string {
  const count = points.length;
  const at = (index: number): Point => points[(index + count) % count] ?? points[0] ?? { x: 0, y: 0 };
  const start = points[0] ?? { x: 0, y: 0 };
  const commands = [`M ${n(start.x)} ${n(start.y)}`];
  const last = closed ? count : count - 1;
  for (let index = 0; index < last; index += 1) {
    const p0 = closed ? at(index - 1) : (points[Math.max(0, index - 1)] ?? start);
    const p1 = closed ? at(index) : (points[index] ?? start);
    const p2 = closed ? at(index + 1) : (points[Math.min(count - 1, index + 1)] ?? p1);
    const p3 = closed ? at(index + 2) : (points[Math.min(count - 1, index + 2)] ?? p2);
    if (!closed && index >= count - 1) break;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    commands.push(`C ${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2.x)} ${n(p2.y)}`);
  }
  if (closed) commands.push('Z');
  return commands.join(' ');
}

function polyline(points: readonly Point[], closed: boolean): string {
  const head = points[0] ?? { x: 0, y: 0 };
  const commands = [`M ${n(head.x)} ${n(head.y)}`];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    commands.push(`L ${n(point.x)} ${n(point.y)}`);
  }
  if (closed) commands.push('Z');
  return commands.join(' ');
}

function mostlyCorners(points: readonly Point[]): boolean {
  if (points.length < 3) return true;
  let sharp = 0;
  for (let index = 0; index < points.length; index += 1) {
    const prev = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!prev || !current || !next) continue;
    if (turn(prev, current, next) < 2.2) sharp += 1;
  }
  return sharp >= points.length - 1;
}

function turn(prev: Point, current: Point, next: Point): number {
  const ax = prev.x - current.x;
  const ay = prev.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const denom = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (denom < 1e-6) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / denom)));
}

function rdp(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return [...points];
  let farthest = 1;
  let distance = -1;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (!point) continue;
    const gap = pointLineDistance(point, first, last);
    if (gap > distance) {
      distance = gap;
      farthest = index;
    }
  }
  if (distance > epsilon) {
    const point = points[farthest];
    const left = rdp(points.slice(0, farthest + 1), epsilon);
    const right = point ? rdp(points.slice(farthest), epsilon) : [];
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function pointLineDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

function diagonal(points: readonly Point[]): number {
  const box = boxOf(points);
  return Math.hypot(box.maxX - box.minX, box.maxY - box.minY);
}

function openRing(points: readonly Point[]): Point[] {
  const cleaned = dedupePoints(points);
  if (cleaned.length < 2) return cleaned;
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) < 1.5) return cleaned.slice(0, -1);
  return cleaned;
}

function dedupePoints(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.5) continue;
    out.push(point);
  }
  return out;
}

function mapContour(contour: Contour, sourceWidth: number, sourceHeight: number): MappedContour {
  const pad = 48;
  const scale = Math.min((LESSON_WIDTH - pad * 2) / Math.max(1, sourceWidth), (LESSON_HEIGHT - pad * 2) / Math.max(1, sourceHeight));
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
    path: smoothPath(points, contour.closed),
  };
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
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, area: 0 };
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
      const otherBox = boxOf(other.points);
      const width = Math.max(0, Math.min(box.maxX, otherBox.maxX) - Math.max(box.minX, otherBox.minX));
      const height = Math.max(0, Math.min(box.maxY, otherBox.maxY) - Math.max(box.minY, otherBox.minY));
      const intersection = width * height;
      const union = box.area + otherBox.area - intersection;
      const overlap = union <= 0 ? 0 : intersection / union;
      return overlap >= 0.82 && ratio > 0.75 && ratio < 1.34;
    });
    if (!duplicate) kept.push(shape);
  }
  return kept;
}

function pointInPolygon(x: number, y: number, points: readonly Point[]): boolean {
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

function average(items: readonly Rgb[]): Rgb {
  const count = Math.max(1, items.length);
  return {
    r: items.reduce((sum, item) => sum + item.r, 0) / count,
    g: items.reduce((sum, item) => sum + item.g, 0) / count,
    b: items.reduce((sum, item) => sum + item.b, 0) / count,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}
