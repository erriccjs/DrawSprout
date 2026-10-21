/**
 * Traced lines become a lesson. A named part keeps its real outline.
 *
 * A circle or oval is added first only when it fits that outline. When the
 * vision model names nothing usable, the lesson falls back to one named
 * outline and drops unnamed scraps instead of printing a generic sentence.
 * See D-70, D-71, D-72, and D-73.
 */

import { assertValidLessons } from '../lesson-data/validate';
import { LESSON_SCHEMA_VERSION, type ColorRegion, type GuidePath, type LessonPackage, type LessonStep } from '../lesson-data/schema';
import { knownColourName } from './colors';
import { flatColourRegions, type FlatRegion } from './flat-colour';
import { cleanPartName, type DetectedPart } from './parts';
import type { RgbaImage } from './png';
import type { Contour, Point } from './trace';

export const LESSON_WIDTH = 1000;
export const LESSON_HEIGHT = 750;
/** Largest closed outline / subject box. Below this, the drawing is asked for again. */
export const OUTLINE_COVERAGE_MIN = 0.6;
/** Filled overlap required before a circle or oval may introduce a part. */
export const CONSTRUCTION_IOU_MIN = 0.9;
/** A box larger than this fraction of the subject cannot claim an interior piece. */
const HUGE_PART = 0.72;
/** Outline, construction, and details together. Extra details are merged away. */
const MAX_DRAWING_STEPS = 7;
const MASK_W = 160;
const MASK_H = 120;
const MIN_NEW_INK = 10;
const CONTAIN_MIN = 0.45;

export interface BuiltLesson {
  readonly lesson: LessonPackage;
  readonly coverage: number;
  /** Same figure as `coverage`: outline box / subject box. */
  readonly subjectFit: number;
  readonly builder: 'parts' | 'traced';
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
  readonly reviewReasons: readonly string[];
  /** Interior contours that were not given their own part name. */
  readonly unnamedInteriors: number;
}

export interface LessonPiece {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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
  /** Closed colour regions in the same pixel space as `contours`. */
  readonly flatRegions?: readonly FlatRegion[];
}): BuiltLesson {
  const mapped = input.contours
    .map((contour) => mapContour(contour, input.sourceWidth, input.sourceHeight))
    .filter((contour) => contour.points.length >= 3)
    .map((contour, id) => ({ ...contour, id }));
  if (mapped.length === 0) throw new Error('No drawable shapes were found in the illustration');
  const named = buildFromParts(input, mapped);
  if (named) return named;
  return buildTracedFallback(input, mapped);
}

/** Boxes for the same contours `buildPhotoLesson` numbers, so the model can name each piece. */
export function lessonPieces(
  contours: readonly Contour[],
  sourceWidth: number,
  sourceHeight: number,
): LessonPiece[] {
  return contours
    .map((contour) => mapContour(contour, sourceWidth, sourceHeight))
    .filter((contour) => contour.points.length >= 3)
    .map((contour, id) => {
      const box = boxOf(contour.points);
      return {
        id,
        x: round(box.minX),
        y: round(box.minY),
        width: round(Math.max(0, box.maxX - box.minX)),
        height: round(Math.max(0, box.maxY - box.minY)),
      };
    });
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
  readonly id: number;
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
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly parts?: readonly DetectedPart[];
  readonly flatRegions?: readonly FlatRegion[];
}, mapped: readonly MappedContour[]): BuiltLesson | null {
  const parts = (input.parts ?? []).filter((part) => cleanPartName(part.name) === part.name);
  if (parts.length === 0) return null;
  const main = pickMain(mapped);
  const subject = unionBox(mapped.map((contour) => boxOf(contour.points)));
  const coverage = boxOf(main.points).area / Math.max(1, subject.area);
  const kept = mapped.filter((contour) => contour.id === main.id || !isSpeck(contour, boxOf(main.points)));
  const outlinePart = outlineOwner(main, parts);
  const outlineName = outlinePart?.name ?? subjectNoun(input.title);
  if (!outlineName) return null;
  const spokenOutline = plainNoun(bareName(outlineName)) || plainNoun(outlineName) || outlineName;

  const bundles = new Map<string, DetailBundle>();
  const separate: MappedContour[] = [];
  let unnamed = 0;
  for (const contour of kept) {
    if (contour.id === main.id) continue;
    if (isSeparateObject(contour, main)) {
      separate.push(contour);
      continue;
    }
    const owner = partAt(contour, parts, subject);
    if (!owner) {
      unnamed += 1;
      continue;
    }
    const name = plainNoun(bareName(owner.name)) || owner.name;
    const bundle = bundles.get(name) ?? { name, pair: false, count: 0, contours: [] };
    bundle.pair = bundle.pair || owner.pair;
    if (owner.count > bundle.count) bundle.count = owner.count;
    bundle.contours.push(contour);
    bundles.set(name, bundle);
  }

  const steps: LessonStep[] = [];
  const preview: GuidePath[] = [];
  const fit = constructionOf(main.points);
  if (fit) {
    const id = 'construct-1';
    const guide: GuidePath = { id: `${id}-1`, d: fit.d, role: 'construction' };
    steps.push(lineStep(id, 'outline', constructionInstruction(fit.kind, spokenOutline), [guide]));
  }
  const outlineGuides = guidesFor('outline-1', [main]);
  preview.push(...outlineGuides);
  steps.push(lineStep('outline-1', 'outline', outlineInstruction(outlineName, input.title), outlineGuides));
  separate.forEach((contour, index) => {
    const owner = partAt(contour, parts, subject);
    const name = plainNoun(bareName(owner?.name ?? '')) || spokenOutline;
    const id = `outline-${index + 2}`;
    const guides = guidesFor(id, [contour]);
    preview.push(...guides);
    steps.push(lineStep(id, 'outline', outlineInstruction(name, input.title), guides));
  });

  const fixed = (fit ? 1 : 0) + 1 + separate.length;
  const pruned = pruneDetails([...bundles.values()], [main], Math.max(0, MAX_DRAWING_STEPS - fixed));
  pruned.kept.forEach((bundle, index) => {
    const id = `detail-${index + 1}`;
    const inks = uniqueContours(bundle.contours);
    if (inks.length === 0) return;
    const guides = guidesFor(id, inks);
    preview.push(...guides);
    steps.push(lineStep(id, 'detail', detailInstruction(bundle, inks), guides));
  });

  const regions: ColorRegion[] = [];
  const colour = appendFlatColours(steps, regions, input, parts, spokenOutline, subject);
  const notes = [...colour.notes];
  if (pruned.invisible) notes.push('Ada langkah yang tidak menambah garis. Cek dulu sebelum dipakai.');
  return finish(input, steps, regions, preview, mapped, coverage, 'parts', unnamed, notes, colour.names);
}

function buildTracedFallback(input: {
  readonly id: string;
  readonly title: string;
  readonly targetHash: string;
  readonly photo: RgbaImage;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly flatRegions?: readonly FlatRegion[];
}, mapped: readonly MappedContour[]): BuiltLesson {
  const main = pickMain(mapped);
  const mainBox = boxOf(main.points);
  const interiors = dedupe(mapped.filter((shape) => shape.id !== main.id && !isSpeck(shape, mainBox)));
  const subject = unionBox(mapped.map((shape) => boxOf(shape.points)));
  const coverage = mainBox.area / Math.max(1, subject.area);
  const noun = subjectNoun(input.title);
  const steps: LessonStep[] = [];
  const preview: GuidePath[] = [];
  const regions: ColorRegion[] = [];
  const outline = guidesFor('outline-1', [main]);
  preview.push(...outline);
  const spoken = plainNoun(noun ?? '') || noun || '';
  steps.push(lineStep('outline-1', 'outline', outlineInstruction(spoken, input.title), outline));
  const colour = spoken ? appendFlatColours(steps, regions, input, [], spoken, subject) : { notes: [], names: [] as string[] };
  return finish(input, steps, regions, preview, mapped, coverage, 'traced', interiors.length, colour.notes, colour.names);
}

function finish(
  input: {
    readonly id: string;
    readonly title: string;
    readonly targetHash: string;
  },
  steps: LessonStep[],
  regions: ColorRegion[],
  preview: GuidePath[],
  mapped: readonly MappedContour[],
  coverage: number,
  builder: 'parts' | 'traced',
  unnamedInteriors: number,
  notes: readonly string[] = [],
  regionNames: readonly string[] = [],
): BuiltLesson {
  const uniqueSteps = uniquify(steps);
  const drawing = uniqueSteps.filter((step) => step.phase !== 'color');
  const colours = uniqueSteps.filter((step) => step.phase === 'color');
  const reasons: string[] = [];
  if (coverage < OUTLINE_COVERAGE_MIN) reasons.push('Garis luar hanya menutupi sebagian subjek. Cek dulu sebelum dipakai.');
  if (drawing.length < 3) reasons.push('Terlalu sedikit langkah menggambar. Cek dulu sebelum dipakai.');
  if (drawing.length > MAX_DRAWING_STEPS) reasons.push('Terlalu banyak langkah menggambar. Cek dulu sebelum dipakai.');
  if (uniqueSteps.some((step) => isGenericInstruction(step.instruction))) {
    reasons.push('Ada instruksi yang belum menyebut bagian. Cek dulu sebelum dipakai.');
  }
  const palette = new Set(regionNames);
  if (colours.length < 2 && palette.size >= 2) reasons.push('Warna subjek lebih dari satu. Cek dulu sebelum dipakai.');
  if (colours.length > 4) reasons.push('Terlalu banyak langkah warna. Cek dulu sebelum dipakai.');
  if (palette.size > 0 && colours.some((step) => {
    const name = colourWord(step.instruction);
    return name !== null && !palette.has(name);
  })) reasons.push('Ada warna yang tidak ada pada gambar. Cek dulu sebelum dipakai.');
  for (const note of notes) {
    if (!reasons.includes(note)) reasons.push(note);
  }
  if (uniqueSteps.some((step) => repeatsWords(step.instruction))) {
    reasons.push('Ada instruksi yang mengulang kata. Cek dulu sebelum dipakai.');
  }
  const construction = new Set(uniqueSteps.flatMap((step) => step.guidePaths.filter((path) => path.role === 'construction').map((path) => path.d)));
  if (preview.some((path) => path.role === 'construction' || construction.has(path.d))) {
    reasons.push('Bentuk bantu ikut gambar akhir. Cek dulu sebelum dipakai.');
  }
  if (uniqueSteps.some((step) => /\btambahkan dua\b/.test(normalizeInstruction(step.instruction)) && step.guidePaths.length !== 2)) {
    reasons.push('Jumlah bagian tidak sesuai instruksi. Cek dulu sebelum dipakai.');
  }
  const needsReview = reasons.length > 0;
  const lesson: LessonPackage = {
    id: input.id,
    schemaVersion: LESSON_SCHEMA_VERSION,
    contentVersion: `photo-${input.targetHash.slice(0, 12)}`,
    title: sanitizeTitle(input.title),
    subtitle: 'Dari foto',
    coordinateSpace: { width: LESSON_WIDTH, height: LESSON_HEIGHT },
    steps: uniqueSteps,
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
    reviewReason: needsReview ? reasons.join(' ') : null,
    reviewReasons: reasons,
    unnamedInteriors,
  };
}

interface DetailBundle {
  name: string;
  pair: boolean;
  count: number;
  contours: MappedContour[];
}

interface ColourBucket {
  colour: string;
  hex: string;
  pixels: number;
  names: string[];
  paths: string[];
}

const ADJECTIVES = new Set([
  'hitam', 'putih', 'lucu', 'merah', 'biru', 'kuning', 'hijau', 'ungu', 'cokelat', 'coklat',
  'oranye', 'jingga', 'abu-abu', 'besar', 'kecil', 'tua', 'muda', 'imut', 'cantik', 'manis',
  'gelap', 'terang', 'gemas', 'bagus',
]);

function plainNoun(name: string): string {
  return name.split(' ').filter((word) => word.length > 0 && !ADJECTIVES.has(word)).join(' ');
}

function loadRegions(input: {
  readonly photo: RgbaImage;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly flatRegions?: readonly FlatRegion[];
}): FlatRegion[] {
  if (input.flatRegions) return [...input.flatRegions];
  const extracted = flatColourRegions(input.photo);
  const sx = input.sourceWidth / Math.max(1, input.photo.width);
  const sy = input.sourceHeight / Math.max(1, input.photo.height);
  if (Math.abs(sx - 1) < 1e-3 && Math.abs(sy - 1) < 1e-3) return extracted;
  return extracted.map((region) => ({
    ...region,
    cx: region.cx * sx,
    cy: region.cy * sy,
    points: region.points.map((point) => ({ x: point.x * sx, y: point.y * sy })),
  }));
}

function appendFlatColours(
  steps: LessonStep[],
  regions: ColorRegion[],
  input: {
    readonly photo: RgbaImage;
    readonly sourceWidth: number;
    readonly sourceHeight: number;
    readonly flatRegions?: readonly FlatRegion[];
  },
  parts: readonly DetectedPart[],
  spoken: string,
  subject: Box,
): { notes: string[]; names: string[] } {
  const loaded = loadRegions(input);
  const notes: string[] = [];
  let empty = false;
  let mixed = false;
  const buckets = new Map<string, ColourBucket>();
  for (const region of loaded) {
    if (region.name === 'putih') continue;
    if (region.mixed) mixed = true;
    const mapped = mapContour({ points: region.points, closed: true }, input.sourceWidth, input.sourceHeight);
    if (mapped.points.length < 3) continue;
    const area = boxOf(mapped.points).area;
    if (area < 400) continue;
    if (fillSamples(mapped.points) < 4) {
      empty = true;
      continue;
    }
    const label = nameAt(region.cx, region.cy, input, parts, subject, spoken);
    const key = `${label}|${region.name}`;
    const bucket = buckets.get(key) ?? { colour: region.name, hex: region.hex, pixels: 0, names: [], paths: [] };
    bucket.pixels += region.pixels;
    bucket.paths.push(mapped.path);
    if (label && !bucket.names.includes(label)) bucket.names.push(label);
    buckets.set(key, bucket);
  }
  if (empty) notes.push('Ada langkah warna yang tidak mengisi. Cek dulu sebelum dipakai.');
  if (mixed) notes.push('Ada bagian dengan lebih dari satu warna. Cek dulu sebelum dipakai.');
  const rows = [...buckets.values()].sort((left, right) => right.pixels - left.pixels);
  rows.forEach((bucket, index) => {
    const id = `color-${index + 1}`;
    const regionIds = bucket.paths.map((path, pathIndex) => {
      const regionId = `${id}-r${pathIndex + 1}`;
      regions.push({
        id: regionId,
        label: bucket.names[0] ?? spoken,
        d: path,
        suggestedColor: bucket.hex,
      });
      return regionId;
    });
    if (regionIds.length === 0) return;
    steps.push({
      id,
      phase: 'color',
      instruction: colourInstruction(bucket.names.length > 0 ? bucket.names : [spoken], bucket.colour),
      guidePaths: [],
      colorRegionIds: regionIds,
      toolPreset: { tool: 'brush', color: bucket.hex, widthViewbox: 36 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
  });
  return { notes, names: loaded.map((region) => region.name) };
}

function nameAt(
  x: number,
  y: number,
  input: { readonly sourceWidth: number; readonly sourceHeight: number },
  parts: readonly DetectedPart[],
  subject: Box,
  spoken: string,
): string {
  const point = sourceToLesson(x, y, input.sourceWidth, input.sourceHeight);
  let best: DetectedPart | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    if (partFraction(part, subject) > HUGE_PART) continue;
    if (!containsPoint(part, point)) continue;
    const area = areaOf(part);
    if (area < bestArea) {
      best = part;
      bestArea = area;
    }
  }
  const named = best ? plainNoun(bareName(best.name)) : '';
  return named || spoken;
}

function fillSamples(points: readonly Point[]): number {
  const box = boxOf(points);
  const cols = 36;
  const rows = 27;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  let inside = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = box.minX + ((x + 0.5) / cols) * width;
      const py = box.minY + ((y + 0.5) / rows) * height;
      if (pointInPolygon(px, py, points)) inside += 1;
    }
  }
  return inside;
}

function sourceToLesson(x: number, y: number, sourceWidth: number, sourceHeight: number): Point {
  const place = sourcePlacement(sourceWidth, sourceHeight);
  return { x: place.offsetX + x * place.scale, y: place.offsetY + y * place.scale };
}

function pruneDetails(
  bundles: readonly DetailBundle[],
  outline: readonly MappedContour[],
  room: number,
): { kept: DetailBundle[]; invisible: boolean } {
  const ranked = [...bundles].sort((left, right) => ownInk(right.contours) - ownInk(left.contours));
  const mask = new Uint8Array(MASK_W * MASK_H);
  stampContours(mask, outline);
  const kept: DetailBundle[] = [];
  let invisible = false;
  for (const bundle of ranked) {
    if (kept.length >= room) break;
    const own = ownInk(bundle.contours);
    const fresh = freshInk(mask, bundle.contours);
    if (fresh < MIN_NEW_INK) {
      if (own >= MIN_NEW_INK) invisible = true;
      continue;
    }
    stampContours(mask, bundle.contours);
    kept.push(bundle);
  }
  return { kept, invisible };
}

function ownInk(contours: readonly MappedContour[]): number {
  const mask = new Uint8Array(MASK_W * MASK_H);
  stampContours(mask, contours);
  let count = 0;
  for (const value of mask) if (value) count += 1;
  return count;
}

function freshInk(existing: Uint8Array, contours: readonly MappedContour[]): number {
  const covered = dilateMask(existing);
  const scratch = covered.slice();
  stampContours(scratch, contours);
  let fresh = 0;
  for (let index = 0; index < scratch.length; index += 1) {
    if (scratch[index] && !covered[index]) fresh += 1;
  }
  return fresh;
}

function dilateMask(mask: Uint8Array): Uint8Array {
  const out = mask.slice();
  for (let y = 0; y < MASK_H; y += 1) {
    for (let x = 0; x < MASK_W; x += 1) {
      if (!mask[y * MASK_W + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sy >= 0 && sx < MASK_W && sy < MASK_H) out[sy * MASK_W + sx] = 1;
        }
      }
    }
  }
  return out;
}

function stampContours(mask: Uint8Array, contours: readonly MappedContour[]): void {
  for (const contour of contours) {
    const points = samplePath(contour.path);
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      if (start && end) stampSegment(mask, start, end);
    }
  }
}

/** The shipped path, sampled the way the contact sheet draws it. */
function samplePath(d: string): Point[] {
  const tokens = d.match(/[a-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const points: Point[] = [];
  let index = 0;
  let start: Point | null = null;
  let cursor = { x: 0, y: 0 };
  const take = (offset: number) => Number(tokens[index + offset] ?? '0');
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
      cursor = { x: take(1), y: take(2) };
      if (command === 'M') start = cursor;
      points.push(cursor);
      index += 3;
      continue;
    }
    if (command === 'H') {
      cursor = { x: take(1), y: cursor.y };
      points.push(cursor);
      index += 2;
      continue;
    }
    if (command === 'V') {
      cursor = { x: cursor.x, y: take(1) };
      points.push(cursor);
      index += 2;
      continue;
    }
    if (command === 'C') {
      const c1 = { x: take(1), y: take(2) };
      const c2 = { x: take(3), y: take(4) };
      const end = { x: take(5), y: take(6) };
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        const mt = 1 - t;
        points.push({
          x: mt * mt * mt * cursor.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * end.x,
          y: mt * mt * mt * cursor.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * end.y,
        });
      }
      cursor = end;
      index += 7;
      continue;
    }
    if (command === 'A') {
      const end = { x: take(6), y: take(7) };
      points.push(end);
      cursor = end;
      index += 8;
      continue;
    }
    index += 1;
  }
  return points;
}

function stampSegment(mask: Uint8Array, start: Point, end: Point): void {
  const from = maskPoint(start);
  const to = maskPoint(end);
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (x >= 0 && y >= 0 && x < MASK_W && y < MASK_H) mask[y * MASK_W + x] = 1;
    if (x === to.x && y === to.y) break;
    const doubled = err * 2;
    if (doubled > -dy) {
      err -= dy;
      x += sx;
    }
    if (doubled < dx) {
      err += dx;
      y += sy;
    }
  }
}

function maskPoint(point: Point): { x: number; y: number } {
  return {
    x: Math.round((point.x * (MASK_W - 1)) / LESSON_WIDTH),
    y: Math.round((point.y * (MASK_H - 1)) / LESSON_HEIGHT),
  };
}

function bareName(name: string): string {
  let text = name.trim();
  while (text.startsWith('garis luar')) text = text.slice('garis luar'.length).trim();
  return text;
}

function outlineInstruction(name: string, title: string): string {
  const cleaned = plainNoun(bareName(name)) || plainNoun(subjectNoun(title) ?? '') || '';
  if (!cleaned) return 'Gambar garis luar.';
  return `Gambar garis luar ${cleaned}.`;
}

function detailInstruction(bundle: DetailBundle, inks: readonly MappedContour[]): string {
  return bundleIsPair(bundle, inks) ? `Tambahkan dua ${bundle.name}.` : `Gambar ${bundle.name}.`;
}

function bundleIsPair(bundle: DetailBundle, inks: readonly MappedContour[]): boolean {
  if (inks.length !== 2) return false;
  if (/\bdua\b/.test(bundle.name)) return false;
  if (bundle.count === 2) return true;
  if (bundle.count > 0 && bundle.count !== 2) return false;
  return bundle.pair;
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
  if (!first) return `Warnai bagian ini dengan ${colour}.`;
  if (!second) return `Warnai ${first} dengan ${colour}.`;
  if (!third) return `Warnai ${first} dan ${second} dengan ${colour}.`;
  return `Warnai ${first}, ${second}, dan ${third} dengan ${colour}.`;
}

const GENERIC_COLOUR = /^(merah muda|abu-abu|cokelat tua|merah|oranye|kuning|hijau|biru|ungu|cokelat|hitam|putih)$/;

/** A sentence that does not name a part. Numbered copies of one still match. */
export function isGenericInstruction(text: string): boolean {
  const key = normalizeInstruction(text);
  if (/bagian kecil ini|bentuk yang paling besar|bagian berikutnya|bentuk utama/.test(key)) return true;
  if (/^gambar garis luar$/.test(key)) return true;
  const colourOnly = /^warnai dengan (.+)$/.exec(key);
  return colourOnly !== null && GENERIC_COLOUR.test(colourOnly[1] ?? '');
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
  const cap = steps.length + 2;
  return steps.map((step, index) => {
    const base = fixVerb(step.instruction);
    let text = base;
    let key = normalizeInstruction(text);
    let extra = 0;
    while (used.has(key) && extra < cap) {
      extra += 1;
      const suffix = extra === 1 ? ' yang lain' : ` lagi (${extra})`;
      text = `${base.replace(/\.$/, '')}${suffix}.`;
      key = normalizeInstruction(text);
    }
    if (used.has(key)) {
      text = `${base.replace(/\.$/, '')} (${index + 1}).`;
      key = normalizeInstruction(text);
    }
    used.add(key);
    return text === step.instruction ? step : { ...step, instruction: text };
  });
}

/** Distinct sentences for repeated lines. The loop stops even if a suffix stops changing the key. */
export function uniquifyInstructions(lines: readonly string[]): string[] {
  return uniquify(lines.map((instruction, index) => lineStep(`dup-${index}`, 'detail', instruction, []))).map((step) => step.instruction);
}

function subjectNoun(title: string): string | null {
  const cleaned = sanitizeTitle(title);
  if (cleaned === 'Dari foto') return null;
  return cleanPartName(cleaned);
}

function outlineOwner(contour: MappedContour, parts: readonly DetectedPart[]): DetectedPart | null {
  const listed = parts.filter((part) => part.pieceIds.includes(contour.id));
  if (listed.length > 0) return listed.reduce((best, part) => (areaOf(part) > areaOf(best) ? part : best));
  let best: DetectedPart | null = null;
  let bestArea = -1;
  for (const part of parts) {
    if (containment(contour, part) < CONTAIN_MIN) continue;
    const area = areaOf(part);
    if (area > bestArea) {
      best = part;
      bestArea = area;
    }
  }
  return best;
}

function partAt(contour: MappedContour, parts: readonly DetectedPart[], subject: Box): DetectedPart | null {
  const box = boxOf(contour.points);
  const point = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  let best: DetectedPart | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    if (partFraction(part, subject) > HUGE_PART) continue;
    if (!containsPoint(part, point)) continue;
    if (!boxesOverlap(box, part)) continue;
    const area = areaOf(part);
    if (area < bestArea) {
      best = part;
      bestArea = area;
    }
  }
  return best;
}

function boxesOverlap(ink: Box, part: DetectedPart): boolean {
  return ink.minX <= part.x + part.width && ink.maxX >= part.x && ink.minY <= part.y + part.height && ink.maxY >= part.y;
}

function isSeparateObject(contour: MappedContour, main: MappedContour): boolean {
  if (!contour.closed) return false;
  const area = boxOf(contour.points).area;
  const mainArea = Math.max(1, boxOf(main.points).area);
  if (area < mainArea * 0.18 || area > mainArea * 0.92) return false;
  let total = 0;
  let seen = 0;
  const step = Math.max(1, Math.floor(contour.points.length / 16));
  for (let index = 0; index < contour.points.length; index += step) {
    const point = contour.points[index];
    if (!point) continue;
    total += nearest(point, main.points);
    seen += 1;
  }
  return seen > 0 && total / seen > 18;
}

function nearest(point: Point, line: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length2));
    const gap = Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
    if (gap < best) best = gap;
  }
  return best;
}

function partFraction(part: DetectedPart, subject: Box): number {
  return areaOf(part) / Math.max(1, subject.area);
}

function colourWord(instruction: string): string | null {
  const match = /dengan (.+)$/.exec(normalizeInstruction(instruction));
  const word = match?.[1]?.trim() ?? '';
  if (!word) return null;
  return knownColourName(word);
}

function repeatsWords(text: string): boolean {
  const words = normalizeInstruction(text).split(' ').filter((word) => word.length >= 2);
  for (let index = 1; index < words.length; index += 1) {
    if (words[index] === words[index - 1]) return true;
    const previous = words[index - 1];
    const current = words[index];
    const older = words[index - 3];
    const mid = words[index - 2];
    if (index >= 3 && previous === older && current === mid) return true;
  }
  return false;
}

function containsPoint(part: DetectedPart, point: Point): boolean {
  const polygon = part.points.length >= 3 ? part.points : rectPoints(part);
  return pointInPolygon(point.x, point.y, polygon);
}

function sourcePlacement(sourceWidth: number, sourceHeight: number): { scale: number; offsetX: number; offsetY: number } {
  const pad = 48;
  const scale = Math.min((LESSON_WIDTH - pad * 2) / Math.max(1, sourceWidth), (LESSON_HEIGHT - pad * 2) / Math.max(1, sourceHeight));
  return {
    scale,
    offsetX: (LESSON_WIDTH - sourceWidth * scale) / 2,
    offsetY: (LESSON_HEIGHT - sourceHeight * scale) / 2,
  };
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
  const place = sourcePlacement(sourceWidth, sourceHeight);
  const points = contour.points.map((point) => ({
    x: round(place.offsetX + point.x * place.scale),
    y: round(place.offsetY + point.y * place.scale),
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
    id: 0,
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

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}
