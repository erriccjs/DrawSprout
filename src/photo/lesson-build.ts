/**
 * Traced lines become a lesson. A named part keeps its real outline.
 *
 * A circle or oval is added first only when it fits that outline. When the
 * vision model names nothing usable, the lesson falls back to one named
 * outline and drops unnamed scraps instead of printing a generic sentence.
 * `buildTutorialLesson` orders the steps like a how-to-draw page: one
 * dashed circle or oval inside the main mass, then one part at a time
 * (D-77, D-78, D-79). The line art itself stays a faithful drawing of the photo.
 * `buildPhotoLesson` stays for the earlier pins.
 * See D-70, D-71, D-72, D-73, D-76, D-77, D-78, and D-79.
 */

import { assertValidLessons } from '../lesson-data/validate';
import { LESSON_SCHEMA_VERSION, type ColorRegion, type GuidePath, type LessonPackage, type LessonStep } from '../lesson-data/schema';
import { knownColourName } from './colors';
import { flatColourRegions, type FlatRegion } from './flat-colour';
import { cleanPartName, type DetectedPart, type PlanShape } from './parts';
import type { RgbaImage } from './png';
import type { Contour, Point } from './trace';

export const LESSON_WIDTH = 1000;
export const LESSON_HEIGHT = 750;
/** Largest closed outline / subject box. Below this, the drawing is asked for again. */
export const OUTLINE_COVERAGE_MIN = 0.6;
/** Filled overlap required before a circle or oval may introduce a part. */
export const CONSTRUCTION_IOU_MIN = 0.9;
/** A box larger than the subject itself cannot name an interior line. A petal box the size of the flower still can. */
const WIDE_PART = 1.08;
/** Share of a region that must sit inside a part before that part can name it. */
const ENCLOSE = 0.55;
/** Outline, construction, and details together. Extra details are merged away. */
const MAX_DRAWING_STEPS = 7;
/** How-to-draw lessons scale with the subject, up to about eleven drawing steps. */
export const TUTORIAL_DRAWING_MAX = 11;
const MASK_W = 160;
const MASK_H = 120;
const MIN_NEW_INK = 10;
const CONTAIN_MIN = 0.45;
/** Planned strokes that must stay even when they touch the outline. */
const INTERIOR_STEP = /^(kelopak|tengah|pusat|tengah bunga|kumis|kaki|mata|hidung|lidah|telinga|ekor|sayap|paruh|cakar)$/;
const BACKGROUND_NOUN = /^(tali|biji|biji kopi|meja|lantai|orang|manusia|tangan|kaki orang|alas|latar|latar belakang)$/;

export interface BuiltLesson {
  readonly lesson: LessonPackage;
  readonly coverage: number;
  /** Same figure as `coverage`: outline box / subject box. */
  readonly subjectFit: number;
  readonly builder: 'parts' | 'traced' | 'tutorial';
  /** Part names in draw order. Empty on the traced fallback. */
  readonly planNames: readonly string[];
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

/** Table, people, leashes, and props are not steps, even when they are in the photo. */
export function isBackgroundPart(name: string): boolean {
  const noun = stepNoun(name);
  if (BACKGROUND_NOUN.test(noun)) return true;
  if (/\bbiji\b/.test(noun)) return true;
  if (/\borang\b/.test(noun)) return true;
  return false;
}

/** Plain step name, with side words removed, so both wheels share one step. */
export function partNoun(name: string): string {
  return stepNoun(name);
}

/** Lesson-space box back into the source image, the inverse of the contour placement. */
export function imageRect(
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  sourceWidth: number,
  sourceHeight: number,
): { x: number; y: number; width: number; height: number } {
  const place = sourcePlacement(sourceWidth, sourceHeight);
  const scale = Math.max(1e-6, place.scale);
  return {
    x: (box.x - place.offsetX) / scale,
    y: (box.y - place.offsetY) / scale,
    width: box.width / scale,
    height: box.height / scale,
  };
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

/**
 * How-to-draw lesson. Step 1 is one simple mass. Each later step adds one
 * part, big to small, from the line art's own strokes. Colour is last.
 * With no usable parts, this is `buildPhotoLesson`.
 */
export function buildTutorialLesson(input: Parameters<typeof buildPhotoLesson>[0]): BuiltLesson {
  const parts = (input.parts ?? []).filter((part) => cleanPartName(part.name) === part.name && !isBackgroundPart(part.name));
  if (parts.length === 0) return buildPhotoLesson(input);
  const mapped = mapContours(input.contours, input.sourceWidth, input.sourceHeight);
  if (mapped.length === 0) throw new Error('No drawable shapes were found in the illustration');
  const subject = unionBox(mapped.map((contour) => boxOf(contour.points)));
  const main = pickMain(mapped);
  const coverage = boxOf(main.points).area / Math.max(1, subject.area);
  const assigned = assignGroups(mapped, orderParts(parts), subject);
  return assembleTutorial(input, mapped, assigned.groups, coverage, assigned.unnamed);
}

/**
 * One traced stage per drawing step, earliest first. Used when a line drawing
 * was edited to remove parts, so each step's ink is the pixels that came back.
 */
export function buildNamedLesson(input: Parameters<typeof buildPhotoLesson>[0] & {
  readonly stages: readonly { readonly name: string; readonly contours: readonly Contour[] }[];
}): BuiltLesson | null {
  const mapped: MappedContour[] = [];
  const groups: TutorialGroup[] = [];
  let nextId = 0;
  for (const stage of input.stages) {
    const contours = stage.contours
      .map((contour) => ({ ...mapContour(contour, input.sourceWidth, input.sourceHeight), id: nextId++ }))
      .filter((contour) => contour.points.length >= 3);
    if (contours.length === 0) continue;
    mapped.push(...contours);
    const name = plainNoun(bareName(stage.name)) || stage.name;
    groups.push({
      name,
      parts: [],
      contours,
      guide: false,
      pair: contours.length === 2,
      count: contours.length === 2 ? 2 : 1,
      shape: '',
    });
  }
  if (mapped.length === 0 || groups.length === 0) return null;
  const subject = unionBox(mapped.map((contour) => boxOf(contour.points)));
  const main = pickMain(mapped);
  const coverage = boxOf(main.points).area / Math.max(1, subject.area);
  return assembleTutorial(input, mapped, groups, coverage, 0);
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
  if (!outlineName && !headNoun(input.title)) return null;
  const titleNoun = headNoun(input.title) || plainNoun(bareName(outlineName ?? '')) || outlineName || '';
  const spokenOutline = titleNoun;

  const bundles = new Map<string, DetailBundle>();
  const separate: MappedContour[] = [];
  let unnamed = 0;
  for (const contour of kept) {
    if (contour.id === main.id) continue;
    if (isSeparateObject(contour, main)) {
      separate.push(contour);
      continue;
    }
    const owner = enclosingPart(contour, parts, subject, true);
    if (!owner) {
      unnamed += 1;
      continue;
    }
    const name = plainNoun(bareName(owner.name)) || owner.name;
    if (!name) {
      unnamed += 1;
      continue;
    }
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
  const split = splitCupSaucer(main, parts);
  const pieces = split ?? [main];
  const separateRoom = Math.max(0, MAX_DRAWING_STEPS - (fit ? 1 : 0) - pieces.length);
  const extra = [...separate].sort((left, right) => boxOf(right.points).area - boxOf(left.points).area).slice(0, separateRoom);
  const outlines = [...pieces, ...extra].map((contour) => ({
    contour,
    name: plainNoun(bareName(enclosingPart(contour, parts, subject, false)?.name ?? '')) || titleNoun,
  }));
  outlines.sort((left, right) => Number(right.name === titleNoun) - Number(left.name === titleNoun));
  outlines.forEach((item, index) => {
    const id = `outline-${index + 1}`;
    const guides = guidesFor(id, [item.contour]);
    preview.push(...guides);
    const label = index === 0 ? titleNoun : item.name;
    steps.push(lineStep(id, 'outline', outlineInstruction(label, input.title), guides));
  });

  const fixed = (fit ? 1 : 0) + outlines.length;
  const pruned = pruneDetails([...bundles.values()], outlines.map((item) => item.contour), Math.max(0, MAX_DRAWING_STEPS - fixed));
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
  builder: 'parts' | 'traced' | 'tutorial',
  unnamedInteriors: number,
  notes: readonly string[] = [],
  regionNames: readonly string[] = [],
  maxDrawing = MAX_DRAWING_STEPS,
  planNames: readonly string[] = [],
): BuiltLesson {
  const uniqueSteps = uniquify(steps);
  const drawing = uniqueSteps.filter((step) => step.phase !== 'color');
  const colours = uniqueSteps.filter((step) => step.phase === 'color');
  const reasons: string[] = [];
  if (coverage < OUTLINE_COVERAGE_MIN) reasons.push('Garis luar hanya menutupi sebagian subjek. Cek dulu sebelum dipakai.');
  if (drawing.length < 3) reasons.push('Terlalu sedikit langkah menggambar. Cek dulu sebelum dipakai.');
  if (drawing.length > maxDrawing) reasons.push('Terlalu banyak langkah menggambar. Cek dulu sebelum dipakai.');
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
  if (uniqueSteps.some((step) => /garis\s*luar\s+garis|garisluar|\byang lain\b|lagi \(\d+\)/.test(normalizeInstruction(step.instruction)))) {
    reasons.push('Ada nama bagian yang tidak jelas. Cek dulu sebelum dipakai.');
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
    planNames,
  };
}

interface TutorialGroup {
  name: string;
  parts: DetectedPart[];
  contours: MappedContour[];
  guide: boolean;
  pair: boolean;
  count: number;
  shape: PlanShape | '';
}

function mapContours(contours: readonly Contour[], sourceWidth: number, sourceHeight: number): MappedContour[] {
  return contours
    .map((contour) => mapContour(contour, sourceWidth, sourceHeight))
    .filter((contour) => contour.points.length >= 3)
    .map((contour, id) => ({ ...contour, id }));
}

function orderParts(parts: readonly DetectedPart[]): DetectedPart[] {
  const ranked = [...parts];
  const stated = ranked.filter((part) => (part.order ?? 0) > 0).length;
  if (stated >= Math.ceil(ranked.length / 2)) {
    ranked.sort((left, right) => (left.order ?? 99) - (right.order ?? 99) || areaOf(right) - areaOf(left));
  } else {
    ranked.sort((left, right) => areaOf(right) - areaOf(left));
  }
  const names = new Set(ranked.map((part) => plainNoun(bareName(part.name)) || part.name));
  const done = new Set<string>();
  const pending = ranked;
  const ordered: DetectedPart[] = [];
  let guard = pending.length * pending.length + 1;
  while (pending.length > 0 && guard > 0) {
    guard -= 1;
    const index = pending.findIndex((part) => {
      const need = plainNoun(bareName(part.dependsOn ?? ''));
      return !need || !names.has(need) || done.has(need);
    });
    const next = pending.splice(index < 0 ? 0 : index, 1)[0];
    if (!next) break;
    ordered.push(next);
    done.add(plainNoun(bareName(next.name)) || next.name);
  }
  return ordered;
}

function groupParts(parts: readonly DetectedPart[]): TutorialGroup[] {
  const groups: TutorialGroup[] = [];
  for (const part of parts) {
    const name = stepNoun(part.name) || part.name;
    const existing = groups.find((group) => group.name === name && group.guide === (part.guide === true));
    if (existing) {
      existing.parts.push(part);
      existing.pair = true;
      existing.count = Math.max(existing.count, part.count, existing.parts.length);
      continue;
    }
    groups.push({
      name,
      parts: [part],
      contours: [],
      guide: part.guide === true,
      pair: part.pair,
      count: part.count,
      shape: part.shape ?? '',
    });
  }
  return groups;
}

function assignGroups(
  mapped: readonly MappedContour[],
  parts: readonly DetectedPart[],
  subject: Box,
): { groups: TutorialGroup[]; unnamed: number } {
  const groups = groupParts(parts);
  const buckets = new Map<string, MappedContour[]>(groups.map((group) => [groupKey(group), []]));
  let unnamed = 0;
  for (const contour of mapped) {
    const owner = smallestGroup(contour, groups, subject);
    if (!owner) {
      unnamed += 1;
      continue;
    }
    buckets.get(groupKey(owner))?.push(contour);
  }
  const mass = groups.find((group) => !group.guide) ?? groups[0];
  if (mass) {
    const main = pickMain(mapped);
    const key = groupKey(mass);
    const held = buckets.get(key) ?? [];
    const claimed = [...buckets.values()].some((contours) => contours.includes(main));
    const massHolds = mass.parts.length === 0 || mass.parts.some((part) => containment(main, part) >= CONTAIN_MIN);
    if (!held.includes(main) && (massHolds || !claimed)) {
      let stole = false;
      for (const contours of buckets.values()) {
        const index = contours.indexOf(main);
        if (index < 0) continue;
        contours.splice(index, 1);
        stole = true;
      }
      held.push(main);
      buckets.set(key, held);
      if (!stole) unnamed = Math.max(0, unnamed - 1);
    }
  }
  const loose: MappedContour[] = [];
  const seenLoose = new Set<MappedContour>();
  const addLoose = (contour: MappedContour) => {
    if (seenLoose.has(contour)) return;
    seenLoose.add(contour);
    loose.push(contour);
  };
  if (mass && mass.parts.length > 0) {
    const key = groupKey(mass);
    const held = buckets.get(key) ?? [];
    if (held.length > 1) {
      const primary = pickMain(held);
      buckets.set(key, [primary]);
      for (const contour of held) {
        if (contour !== primary) addLoose(contour);
      }
    }
  }
  const placed = new Set<MappedContour>();
  for (const contours of buckets.values()) {
    for (const contour of contours) placed.add(contour);
  }
  for (const contour of mapped) {
    if (!placed.has(contour)) addLoose(contour);
  }
  for (const contour of loose) {
    const wasPlaced = placed.has(contour);
    const owner = interiorGroup(contour, groups, subject, mass);
    if (!owner) {
      if (wasPlaced) unnamed += 1;
      continue;
    }
    const key = groupKey(owner);
    const held = buckets.get(key) ?? [];
    held.push(contour);
    buckets.set(key, held);
    placed.add(contour);
    if (!wasPlaced) unnamed = Math.max(0, unnamed - 1);
  }
  return {
    unnamed,
    groups: groups
      .map((group) => ({ ...group, contours: buckets.get(groupKey(group)) ?? [] }))
      .slice(0, TUTORIAL_DRAWING_MAX),
  };
}

function groupKey(group: TutorialGroup): string {
  return `${group.guide ? 'g' : 'p'}:${group.name}`;
}

const SIDE_WORDS = new Set(['kiri', 'kanan', 'depan', 'belakang', 'atas', 'bawah']);

function stepNoun(name: string): string {
  const plain = plainNoun(bareName(name));
  const words = plain.split(' ').filter((word) => word.length > 0 && !SIDE_WORDS.has(word));
  return words.join(' ') || plain;
}

function massPrimitive(
  group: TutorialGroup,
  contour: MappedContour | undefined,
  groups: readonly TutorialGroup[],
): { d: string; word: string } | null {
  const part = guidePart(group, groups);
  const region = guideRegion(part, contour, group);
  if (!region) return null;
  const preferCircle = wantsCircle(group, part);
  const fitted = fitEllipse(contour?.points, region, preferCircle);
  if (!fitted) return null;
  return { d: fitted.d, word: fitted.circle ? 'lingkaran' : 'oval' };
}

function wantsCircle(group: TutorialGroup, part: DetectedPart | undefined): boolean {
  if (group.shape === 'dome' || part?.shape === 'dome') return false;
  if (group.shape === 'circle' || part?.shape === 'circle') return true;
  if (group.shape === 'oval' || part?.shape === 'oval') return false;
  if (!part) return false;
  const ratio = part.width / Math.max(1, part.height);
  return ratio <= 1.35 && ratio >= 1 / 1.35;
}

function guidePart(group: TutorialGroup, groups: readonly TutorialGroup[]): DetectedPart | undefined {
  const massPart = [...group.parts].sort((left, right) => areaOf(right) - areaOf(left))[0];
  const massNoun = massPart ? stepNoun(massPart.name) : group.name;
  if (massPart && /^(kepala|wajah|cangkir|bunga)$/.test(massNoun)) return massPart;
  const named = groups.flatMap((item) => item.parts).filter((part) => /^(kepala|wajah|cangkir)$/.test(stepNoun(part.name)));
  if (massPart) {
    const inner = named
      .filter((part) => areaOf(part) < areaOf(massPart) * 0.85)
      .sort((left, right) => areaOf(right) - areaOf(left))[0];
    if (inner) return inner;
  }
  return massPart ?? named[0];
}

function guideRegion(
  part: DetectedPart | undefined,
  contour: MappedContour | undefined,
  group: TutorialGroup,
): { cx: number; cy: number; rx: number; ry: number } | null {
  const fromPart = part && part.width >= 12 && part.height >= 12
    ? { x: part.x, y: part.y, w: part.width, h: part.height }
    : null;
  const fromContour = contour ? boxOf(contour.points) : null;
  const box = fromPart ?? (fromContour
    ? { x: fromContour.minX, y: fromContour.minY, w: fromContour.maxX - fromContour.minX, h: fromContour.maxY - fromContour.minY }
    : null);
  if (!box || box.w < 12 || box.h < 12) return null;
  const noun = stepNoun(part?.name ?? group.name);
  const dome = group.shape === 'dome' || part?.shape === 'dome';
  const tall = box.h > box.w * 1.25 && /^(cangkir|bunga|kepala)$/.test(noun);
  const height = dome || tall ? box.h * 0.62 : box.h;
  return { cx: box.x + box.w / 2, cy: box.y + height / 2, rx: box.w / 2, ry: height / 2 };
}

function fitEllipse(
  points: readonly Point[] | undefined,
  region: { cx: number; cy: number; rx: number; ry: number },
  preferCircle: boolean,
): { d: string; circle: boolean } | null {
  let rx = Math.max(8, region.rx);
  let ry = Math.max(8, region.ry);
  if (preferCircle) {
    const radius = Math.min(rx, ry);
    rx = radius;
    ry = radius;
  }
  const emit = (scale: number) => {
    const srx = rx * scale;
    const sry = ry * scale;
    const circle = Math.abs(srx - sry) / Math.max(srx, sry) < 0.18;
    return { d: ellipsePath(region.cx, region.cy, srx, sry), circle: preferCircle || circle };
  };
  if (!points || points.length < 4) return emit(0.86);
  for (let scale = 0.9; scale >= 0.42; scale -= 0.04) {
    if (rimInside(points, region.cx, region.cy, rx * scale, ry * scale) >= 0.8) return emit(scale);
  }
  return emit(0.42);
}

function rimInside(polygon: readonly Point[], cx: number, cy: number, rx: number, ry: number): number {
  const samples = 24;
  let hits = 0;
  for (let index = 0; index < samples; index += 1) {
    const angle = (index / samples) * Math.PI * 2;
    if (pointInPolygon(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry, polygon)) hits += 1;
  }
  return hits / samples;
}

function interiorGroup(
  contour: MappedContour,
  groups: readonly TutorialGroup[],
  subject: Box,
  mass: TutorialGroup | undefined,
): TutorialGroup | null {
  const center = { x: contour.cx, y: contour.cy };
  let best: TutorialGroup | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  let bestScore = 0;
  for (const group of groups) {
    if (group === mass || group.guide || isBackgroundPart(group.name) || !INTERIOR_STEP.test(group.name)) continue;
    for (const part of group.parts) {
      const share = containment(contour, part);
      const centerIn = containsPoint(part, center);
      const fraction = partFraction(part, subject);
      const wide = fraction > 0.97 || fraction > WIDE_PART;
      if (share < 0.35 && !centerIn) continue;
      if (wide && !centerIn) continue;
      const area = areaOf(part);
      const score = Math.max(share, centerIn ? 0.35 : 0);
      if (score > bestScore + 0.02 || (score >= bestScore - 0.02 && area < bestArea)) {
        best = group;
        bestArea = area;
        bestScore = score;
      }
    }
  }
  return best;
}

function boxPrimitive(part: DetectedPart, id: string): GuidePath | null {
  if (part.shape === 'line') {
    const cy = part.y + part.height / 2;
    return {
      id,
      d: `M ${n(part.x)} ${n(cy)} L ${n(part.x + part.width)} ${n(cy)}`,
      role: 'final-outline',
    };
  }
  const shape = part.shape === 'dome'
    ? 'oval'
    : part.shape === 'circle' || part.shape === 'oval' || part.shape === 'triangle'
      ? part.shape
      : part.width / Math.max(1, part.height) > 1.35 || part.height / Math.max(1, part.width) > 1.35
        ? 'oval'
        : 'circle';
  const drawn = renderGuide({ ...part, shape }, id)[0];
  if (!drawn) return null;
  return { ...drawn, id, role: 'final-outline' };
}

const ANIMAL_WORD = /\b(kucing|anjing|burung|ikan|lebah|sapi|panda|kelinci|kuda|katak|hamster|tikus|hewan)\b/;
const ANIMAL_DETAIL = /^(telinga|mata|hidung|lidah|kaki|ekor|kumis|sayap|paruh|cakar)$/;

function animalDetailGap(title: string, groups: readonly TutorialGroup[], steps: readonly LessonStep[]): string | null {
  const blob = `${title} ${groups.map((group) => group.name).join(' ')}`.toLowerCase();
  if (!ANIMAL_WORD.test(blob)) return null;
  const planned = groups.filter((group) => !group.guide && ANIMAL_DETAIL.test(group.name));
  if (planned.length < 4) return null;
  const text = steps.filter((step) => step.phase !== 'color').map((step) => normalizeInstruction(step.instruction)).join(' ');
  const present = planned.filter((group) => text.includes(group.name)).length;
  if (present < planned.length) return 'Detail hewan terlalu sedikit. Cek dulu sebelum dipakai.';
  return null;
}

function smallestGroup(contour: MappedContour, groups: readonly TutorialGroup[], subject: Box): TutorialGroup | null {
  let best: TutorialGroup | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const group of groups) {
    if (group.guide) continue;
    for (const part of group.parts) {
      const fraction = partFraction(part, subject);
      if (fraction > 0.97) continue;
      if (fraction > WIDE_PART) continue;
      if (containment(contour, part) < ENCLOSE) continue;
      const area = areaOf(part);
      if (area < bestArea) {
        best = group;
        bestArea = area;
      }
    }
  }
  return best;
}

function assembleTutorial(
  input: Parameters<typeof buildPhotoLesson>[0],
  mapped: readonly MappedContour[],
  groups: readonly TutorialGroup[],
  coverage: number,
  unnamed: number,
): BuiltLesson {
  const massAt = groups.findIndex((group) => !group.guide);
  const leading = massAt > 0 ? groups.slice(0, massAt).filter((group) => group.guide) : [];
  const steps: LessonStep[] = [];
  const preview: GuidePath[] = [];
  const names: string[] = [];
  const mask = new Uint8Array(MASK_W * MASK_H);
  const notes: string[] = [];
  let invisible = false;
  let dropped = 0;
  const drawn = new Set<string>();
  const allParts = groups.flatMap((group) => group.parts);
  const pushContours = (group: TutorialGroup, contours: readonly MappedContour[], outline: boolean) => {
    if (contours.length === 0) return;
    const id = `draw-${steps.length + 1}`;
    const guides = guidesFor(id, contours);
    stampContours(mask, contours);
    preview.push(...guides);
    if (names[names.length - 1] !== group.name) names.push(group.name);
    drawn.add(group.name);
    const text = outline ? `Gambar garis luar ${group.name}.` : tutorialInstruction(group, false, contours, null);
    steps.push(lineStep(id, steps.length === 0 ? 'outline' : 'detail', text, guides));
  };
  const pushSynthetic = (group: TutorialGroup): boolean => {
    const paths = group.parts
      .map((part, partIndex) => boxPrimitive(part, `box-${partIndex}`))
      .filter((path): path is GuidePath => path !== null);
    if (paths.length === 0) return false;
    const id = `draw-${steps.length + 1}`;
    const guides = paths.map((path, pathIndex) => ({ ...path, id: `${id}-${pathIndex + 1}` }));
    preview.push(...guides);
    if (names[names.length - 1] !== group.name) names.push(group.name);
    drawn.add(group.name);
    const pair = guides.length === 2 && (group.pair || group.count === 2 || group.parts.length === 2) && !/\bdua\b/.test(group.name);
    steps.push(lineStep(
      id,
      steps.length === 0 ? 'outline' : 'detail',
      pair ? `Tambahkan dua ${group.name}.` : `Gambar ${group.name}.`,
      guides,
    ));
    return true;
  };
  groups.forEach((group, index) => {
    if (leading.includes(group)) return;
    if (drawn.has(group.name) || isBackgroundPart(group.name)) {
      dropped += group.contours.length;
      return;
    }
    const isMass = index === massAt;
    let contours = group.contours;
    if (isMass && contours.length > 1 && group.parts.length > 0) {
      const primary = pickMain(contours);
      dropped += contours.length - 1;
      contours = [primary];
    }
    if (isMass) {
      const primitive = massPrimitive(group, contours[0], groups);
      if (primitive) {
        const id = `draw-${steps.length + 1}`;
        const guides: GuidePath[] = [{ id: `${id}-1`, d: primitive.d, role: 'construction' }];
        leading.forEach((guide, guideIndex) => {
          guides.push(...guidePaths(guide, `${id}-g${guideIndex + 1}`));
        });
        if (names[names.length - 1] !== group.name) names.push(group.name);
        steps.push(lineStep(id, 'outline', `Gambar ${primitive.word} besar untuk ${group.name}.`, guides));
      }
      const splitFrom = contours[0];
      const split = splitFrom ? splitCupSaucer(splitFrom, allParts) : null;
      const cup = split?.[0];
      const saucer = split?.[1];
      if (cup && saucer) {
        pushContours({ ...group, name: 'cangkir', pair: false, count: 1 }, [cup], true);
        pushContours({ ...group, name: 'piring', pair: false, count: 1 }, [saucer], true);
        return;
      }
      if (primitive) {
        if (contours.length > 0) pushContours(group, contours, true);
        return;
      }
    }
    if (group.guide) {
      const id = `draw-${steps.length + 1}`;
      const guides = guidePaths(group, `${id}-g1`);
      if (guides.length === 0) return;
      steps.push(lineStep(id, 'detail', tutorialInstruction(group, false, contours, null), guides));
      return;
    }
    if (contours.length > 0) {
      const own = ownInk(contours);
      const fresh = steps.length === 0 ? own : freshInk(mask, contours);
      const mostlyThere = own > 0 && fresh / own < 0.3;
      const keepTouching = group.parts.length > 0 && INTERIOR_STEP.test(group.name) && own >= MIN_NEW_INK;
      if (keepTouching || (fresh >= MIN_NEW_INK && !(steps.length > 0 && mostlyThere))) {
        pushContours(group, contours, false);
        return;
      }
      if (pushSynthetic(group)) return;
      if (own >= MIN_NEW_INK && fresh < MIN_NEW_INK) invisible = true;
      return;
    }
    pushSynthetic(group);
  });
  const animalGap = animalDetailGap(input.title, groups, steps);
  if (animalGap) notes.push(animalGap);
  const regions: ColorRegion[] = [];
  const spoken = headNoun(input.title) || groups.find((group) => !group.guide)?.name || '';
  const subject = unionBox(mapped.map((contour) => boxOf(contour.points)));
  const colour = spoken || (input.parts ?? []).length > 0
    ? appendFlatColours(steps, regions, input, input.parts ?? [], spoken, subject)
    : { notes: [] as string[], names: [] as string[] };
  if (invisible) notes.push('Ada langkah yang tidak menambah garis. Cek dulu sebelum dipakai.');
  return finish(
    input,
    steps,
    regions,
    preview,
    mapped,
    coverage,
    'tutorial',
    unnamed + dropped,
    [...notes, ...colour.notes],
    colour.names,
    TUTORIAL_DRAWING_MAX,
    names,
  );
}

function guidePaths(group: TutorialGroup, id: string): GuidePath[] {
  if (group.contours.length > 0) {
    return group.contours.map((contour, index) => ({
      id: `${id}-${index + 1}`,
      d: contour.path,
      role: 'construction' as const,
    }));
  }
  const part = group.parts[0];
  if (!part) return [];
  const drawn = renderGuide(part, id);
  return drawn;
}

function renderGuide(part: DetectedPart, id: string): GuidePath[] {
  const cx = part.x + part.width / 2;
  const cy = part.y + part.height / 2;
  if (part.shape === 'circle' || part.shape === 'oval' || part.shape === 'dome') {
    const rx = Math.max(8, part.width / 2);
    const ry = part.shape === 'circle' ? Math.max(8, Math.min(part.width, part.height) / 2) : Math.max(8, part.height / 2);
    const d = part.shape === 'dome'
      ? `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx + rx)} ${n(cy)} Z`
      : ellipsePath(cx, cy, rx, ry);
    return [{ id: `${id}-1`, d, role: 'construction' }];
  }
  if (part.shape === 'triangle') {
    const d = `M ${n(cx)} ${n(part.y)} L ${n(part.x + part.width)} ${n(part.y + part.height)} L ${n(part.x)} ${n(part.y + part.height)} Z`;
    return [{ id: `${id}-1`, d, role: 'construction' }];
  }
  if (part.shape === 'line') {
    return [
      { id: `${id}-h`, d: `M ${n(part.x)} ${n(cy)} L ${n(part.x + part.width)} ${n(cy)}`, role: 'construction' },
      { id: `${id}-v`, d: `M ${n(cx)} ${n(part.y)} L ${n(cx)} ${n(part.y + part.height)}`, role: 'construction' },
    ];
  }
  return [];
}

function tutorialInstruction(
  group: TutorialGroup,
  isMass: boolean,
  contours: readonly MappedContour[],
  fit: 'circle' | 'ellipse' | null,
): string {
  if (group.guide) return `Gambar garis bantu untuk ${group.name}.`;
  if (isMass) {
    const word = group.shape === 'dome'
      ? 'kubah'
      : group.shape === 'circle' || fit === 'circle'
        ? 'lingkaran'
        : group.shape === 'oval' || fit === 'ellipse'
          ? 'oval'
          : '';
    if (word) return `Gambar ${word} besar untuk ${group.name}.`;
  }
  if (contours.length === 2 && (group.pair || group.count === 2) && group.count !== 1 && !/\bdua\b/.test(group.name)) {
    return `Tambahkan dua ${group.name}.`;
  }
  return `Gambar ${group.name}.`;
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
  const prepared: Array<{ label: string; colour: string; hex: string; pixels: number; path: string; area: number }> = [];
  for (const region of keepColourRegions(loaded)) {
    if (region.mixed) mixed = true;
    const mapped = mapContour({ points: region.points, closed: true }, input.sourceWidth, input.sourceHeight);
    if (mapped.points.length < 3) continue;
    const area = boxOf(mapped.points).area;
    if (area < 80) continue;
    if (fillSamples(mapped.points) < 4) {
      empty = true;
      continue;
    }
    let label = nameRegion(mapped.points, parts, spoken);
    if (isBackgroundPart(label)) continue;
    let path = mapped.path;
    let keptArea = area;
    const kopi = parts.find((part) => stepNoun(part.name) === 'kopi');
    if (kopi && COFFEE_COLOURS.has(region.name)) {
      const share = regionShare(mapped.points, kopi);
      if (share >= 0.45) label = 'kopi';
      else if (stepNoun(label) === 'cangkir' || stepNoun(label) === stepNoun(spoken) || label === spoken) {
        label = 'kopi';
        path = rectPath(kopi);
        keptArea = areaOf(kopi);
      }
    }
    prepared.push({
      label,
      colour: region.name,
      hex: region.hex,
      pixels: region.pixels,
      path,
      area: keptArea,
    });
  }
  const coloured = collapseDoublePaint(prepared);
  const partColours = new Map<string, Set<string>>();
  let maxArea = 0;
  const buckets = new Map<string, ColourBucket>();
  for (const region of coloured) {
    if (region.area > maxArea) maxArea = region.area;
    const seen = partColours.get(region.label) ?? new Set<string>();
    seen.add(region.colour);
    partColours.set(region.label, seen);
    const bucket = buckets.get(region.colour) ?? { colour: region.colour, hex: region.hex, pixels: 0, names: [], paths: [] };
    if (region.pixels >= bucket.pixels) bucket.hex = region.hex;
    bucket.pixels += region.pixels;
    bucket.paths.push(region.path);
    if (region.label && !bucket.names.includes(region.label)) bucket.names.push(region.label);
    buckets.set(region.colour, bucket);
  }
  if ([...partColours.values()].some((colours) => colours.size > 1)) {
    notes.push('Ada bagian sejenis dengan warna berbeda. Cek dulu sebelum dipakai.');
  }
  if (subject.area > 1000 && maxArea < subject.area * 0.3) {
    notes.push('Bagian besar subjek belum diwarnai. Cek dulu sebelum dipakai.');
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

const COFFEE_COLOURS = new Set(['hitam', 'cokelat tua', 'cokelat']);

function keepColourRegions(regions: readonly FlatRegion[]): FlatRegion[] {
  const sorted = regions.filter((region) => region.name !== 'putih').sort((left, right) => right.pixels - left.pixels);
  const largest = sorted[0]?.pixels ?? 0;
  const kept: FlatRegion[] = [];
  for (const region of sorted) {
    const covered = kept.some((other) => coffeePair(region.name, other.name) && polygonShare(region.points, other.points) >= 0.6);
    if (covered) continue;
    const largeEnough = largest === 0 || region.pixels >= largest * 0.02 || region.pixels >= 500;
    if (!largeEnough && region.pixels < 40) continue;
    if (!largeEnough) {
      const swallowed = kept.some((other) => other.name === region.name && polygonShare(region.points, other.points) >= 0.6);
      if (swallowed) continue;
    }
    kept.push(region);
  }
  return kept;
}

function coffeePair(left: string, right: string): boolean {
  return COFFEE_COLOURS.has(left) && COFFEE_COLOURS.has(right) && left !== right;
}

function polygonShare(inner: readonly Point[], outer: readonly Point[]): number {
  const samples = insideSamples(inner);
  if (samples.length === 0) return 0;
  let hits = 0;
  for (const point of samples) if (pointInPolygon(point.x, point.y, outer)) hits += 1;
  return hits / samples.length;
}

function collapseDoublePaint(regions: Array<{ label: string; colour: string; hex: string; pixels: number; path: string; area: number }>): typeof regions {
  const byLabel = new Map<string, typeof regions>();
  for (const region of regions) {
    const list = byLabel.get(region.label) ?? [];
    list.push(region);
    byLabel.set(region.label, list);
  }
  const kept: typeof regions = [];
  for (const list of byLabel.values()) {
    const colours = new Set(list.map((region) => region.colour));
    const onlyCoffee = [...colours].every((colour) => COFFEE_COLOURS.has(colour));
    if (colours.size > 1 && onlyCoffee) {
      const winner = [...list].sort((left, right) => right.pixels - left.pixels)[0];
      if (winner) kept.push(...list.filter((region) => region.colour === winner.colour));
      continue;
    }
    kept.push(...list);
  }
  return kept;
}

/**
 * The part that owns the region. Highest overlap wins. A near tie keeps the
 * tighter box, so a mouth does not rename the eyes and a neck does not rename
 * the tongue. Background props are not names.
 */
function nameRegion(points: readonly Point[], parts: readonly DetectedPart[], spoken: string): string {
  const small = boxOf(points).area < 22000;
  const bar = small ? 0.35 : 0.45;
  let best: DetectedPart | null = null;
  let bestShare = -1;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    if (isBackgroundPart(part.name)) continue;
    const share = regionShare(points, part);
    if (share < bar) continue;
    const area = areaOf(part);
    if (share > bestShare + 0.02 || (share >= bestShare - 0.02 && area < bestArea)) {
      best = part;
      bestShare = share;
      bestArea = area;
    }
  }
  const named = best ? plainNoun(bareName(best.name)) : '';
  return named || spoken;
}

function regionShare(points: readonly Point[], part: DetectedPart): number {
  const samples = insideSamples(points);
  if (samples.length === 0) return 0;
  let hits = 0;
  for (const point of samples) if (containsPoint(part, point)) hits += 1;
  return hits / samples.length;
}

function insideSamples(points: readonly Point[]): Point[] {
  const box = boxOf(points);
  const cols = 8;
  const rows = 8;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const samples: Point[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const point = { x: box.minX + ((x + 0.5) / cols) * width, y: box.minY + ((y + 0.5) / rows) * height };
      if (pointInPolygon(point.x, point.y, points)) samples.push(point);
    }
  }
  return samples.length > 0 ? samples : [...points];
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
    const mostlyThere = own > 0 && fresh / own < 0.3;
    if (fresh < MIN_NEW_INK || mostlyThere) {
      if (own >= MIN_NEW_INK && fresh < MIN_NEW_INK) invisible = true;
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
  return name.trim().replace(/garis\s*luar/gi, ' ').replace(/\s+/g, ' ').trim();
}

function outlineInstruction(name: string, title: string): string {
  const cleaned = plainNoun(bareName(name)) || headNoun(title);
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

const MODIFIERS = new Set([...ADJECTIVES, 'anak', 'klasik', 'mainan', 'lain', 'yang']);

/** First plain noun of the title: "mobil", not "mobil anak klasik". */
function headNoun(title: string): string {
  const base = subjectNoun(title);
  if (!base) return '';
  const words = plainNoun(bareName(base)).split(' ').filter((word) => word.length > 0 && !MODIFIERS.has(word));
  return words[0] ?? '';
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

/** Smallest part that contains the ink. Wide boxes are skipped for interior lines. */
function enclosingPart(
  contour: MappedContour,
  parts: readonly DetectedPart[],
  subject: Box,
  skipWide: boolean,
): DetectedPart | null {
  let best: DetectedPart | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    const fraction = partFraction(part, subject);
    if (fraction > 0.97) continue;
    if (skipWide && fraction > WIDE_PART) continue;
    if (containment(contour, part) < ENCLOSE) continue;
    const area = areaOf(part);
    if (area < bestArea) {
      best = part;
      bestArea = area;
    }
  }
  return best;
}

/** One connected cup-and-saucer silhouette becomes two outline steps. */
function splitCupSaucer(main: MappedContour, parts: readonly DetectedPart[]): MappedContour[] | null {
  const cup = parts.find((part) => plainNoun(bareName(part.name)) === 'cangkir');
  const saucer = parts.find((part) => plainNoun(bareName(part.name)) === 'piring');
  if (!cup || !saucer) return null;
  if (containment(main, cup) < 0.08 || containment(main, saucer) < 0.08) return null;
  const cupY = cup.y + cup.height / 2;
  const saucerY = saucer.y + saucer.height / 2;
  const height = Math.max(1, boxOf(main.points).maxY - boxOf(main.points).minY);
  if (Math.abs(cupY - saucerY) < Math.max(36, height * 0.12)) return null;
  const mid = (cupY + saucerY) / 2;
  const upper = main.points.filter((point) => point.y <= mid);
  const lower = main.points.filter((point) => point.y >= mid);
  const cupPoints = cupY < saucerY ? upper : lower;
  const saucerPoints = cupY < saucerY ? lower : upper;
  const cupContour = closeContour(cupPoints, main.id);
  const saucerContour = closeContour(saucerPoints, main.id + 1000);
  if (!cupContour || !saucerContour) return null;
  return [cupContour, saucerContour];
}

function closeContour(points: readonly Point[], id: number): MappedContour | null {
  const unique = dedupePoints(points);
  if (unique.length < 4) return null;
  const ring = [...unique];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first.x !== last.x || first.y !== last.y)) ring.push(first);
  return {
    points: ring,
    closed: true,
    area: Math.abs(shoelace(ring)),
    length: polylineLength(ring),
    cx: ring.reduce((sum, point) => sum + point.x, 0) / ring.length,
    cy: ring.reduce((sum, point) => sum + point.y, 0) / ring.length,
    nx: 0,
    ny: 0,
    silhouette: false,
    path: smoothPath(ring, true),
    id,
  };
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

function rectPath(part: DetectedPart): string {
  const right = part.x + part.width;
  const bottom = part.y + part.height;
  return `M ${n(part.x)} ${n(part.y)} L ${n(right)} ${n(part.y)} L ${n(right)} ${n(bottom)} L ${n(part.x)} ${n(bottom)} Z`;
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
