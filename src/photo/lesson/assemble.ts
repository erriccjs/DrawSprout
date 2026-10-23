/**
 * Turns traced contours and named parts into a lesson package.
 * `buildPhotoLesson` keeps the earlier pins. `buildTutorialLesson` orders
 * the steps like a how-to-draw page.
 */

import { localizeBuiltLesson } from '../../i18n/generated';
import type { Locale } from '../../i18n/locale';
import type { ColorRegion, GuidePath, LessonStep } from '../../lesson-data/schema';
import { flatColourRegions } from '../flat-colour';
import type { FlatRegion } from '../flat-colour';
import { cleanPartName } from '../parts';
import type { DetectedPart } from '../parts';
import type { RgbaImage } from '../png';
import type { Contour, Point } from '../trace';
import { COFFEE_COLOURS, CONTAIN_MIN, ENCLOSE, INTERIOR_STEP, MASK_H, MASK_W, MASS_BOX, MAX_DRAWING_STEPS, MIN_NEW_INK, TUTORIAL_DRAWING_MAX, WIDE_PART } from './types';
import type { Box, BuiltLesson, ColourBucket, DetailBundle, MappedContour, TutorialGroup } from './types';
import { areaOf, boxOf, boxPrimitive, centroidOf, closeContour, constructionOf, containment, containsPoint, dedupe, ellipsePath, enclosingPart, fillSamples, freshInk, guidesFor, isSeparateObject, isSpeck, mapContour, mapContours, outlineOwner, ownInk, partFraction, pickMain, polygonShare, renderGuide, stampContours, unionBox, uniqueContours } from './geometry';
import { animalDetailGap, bareName, colourInstruction, constructionInstruction, detailInstruction, headNoun, isBackgroundPart, lineStep, outlineInstruction, plainNoun, stepNoun, subjectNoun, tutorialInstruction } from './words';
import { finish } from './validate';

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
  /**
   * English is applied after the Indonesian lesson is checked. Omitted means
   * Indonesian, which is what saved lessons and the existing tests expect.
   */
  readonly locale?: Locale;
}): BuiltLesson {
  const mapped = input.contours
    .map((contour) => mapContour(contour, input.sourceWidth, input.sourceHeight))
    .filter((contour) => contour.points.length >= 3)
    .map((contour, id) => ({ ...contour, id }));
  if (mapped.length === 0) throw new Error('No drawable shapes were found in the illustration');
  const named = buildFromParts(input, mapped);
  return localizeBuiltLesson(named ?? buildTracedFallback(input, mapped), input.locale);
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
  return localizeBuiltLesson(assembleTutorial(input, mapped, assigned.groups, coverage, assigned.unnamed), input.locale);
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
  return localizeBuiltLesson(assembleTutorial(input, mapped, groups, coverage, 0), input.locale);
}

export function buildFromParts(input: {
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

export function buildTracedFallback(input: {
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

export function orderParts(parts: readonly DetectedPart[]): DetectedPart[] {
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

export function groupParts(parts: readonly DetectedPart[]): TutorialGroup[] {
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

export function assignGroups(
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

export function groupKey(group: TutorialGroup): string {
  return `${group.guide ? 'g' : 'p'}:${group.name}`;
}

export function massPrimitive(
  group: TutorialGroup,
  contour: MappedContour | undefined,
  groups: readonly TutorialGroup[],
): { d: string; word: string } | null {
  const box = massBox(group, contour, groups);
  if (!box) return null;
  const ratio = box.w / Math.max(1, box.h);
  const circle = ratio <= 1.2 && ratio >= 1 / 1.2;
  const side = Math.min(box.w, box.h);
  const rx = Math.max(8, (circle ? side : box.w) / 2 * 0.9);
  const ry = Math.max(8, (circle ? side : box.h) / 2 * 0.9);
  return {
    d: ellipsePath(box.x + box.w / 2, box.y + box.h / 2, rx, ry),
    word: circle ? 'lingkaran' : 'oval',
  };
}

export function guidePart(group: TutorialGroup, groups: readonly TutorialGroup[]): DetectedPart | undefined {
  const preferred = groups.flatMap((item) => item.parts).filter((part) => MASS_BOX.test(stepNoun(part.name)));
  const largest = preferred.sort((left, right) => areaOf(right) - areaOf(left))[0];
  const own = [...group.parts].sort((left, right) => areaOf(right) - areaOf(left))[0];
  return largest ?? own;
}

export function massBox(
  group: TutorialGroup,
  contour: MappedContour | undefined,
  groups: readonly TutorialGroup[],
): { x: number; y: number; w: number; h: number } | null {
  const part = guidePart(group, groups);
  if (part && part.width >= 12 && part.height >= 12) {
    return { x: part.x, y: part.y, w: part.width, h: part.height };
  }
  if (!contour) return null;
  const box = boxOf(contour.points);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width < 12 || height < 12) return null;
  return { x: box.minX, y: box.minY, w: width, h: height };
}

export function interiorGroup(
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

export function smallestGroup(contour: MappedContour, groups: readonly TutorialGroup[], subject: Box): TutorialGroup | null {
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

export function assembleTutorial(
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
      dropped += group.contours.length;
      return;
    }
    if (contours.length > 0) {
      const shown = group.name === 'piring' ? contours.map((contour) => visibleSaucer(contour, allParts)) : contours;
      const own = ownInk(shown);
      const fresh = steps.length === 0 ? own : freshInk(mask, shown);
      const mostlyThere = own > 0 && fresh / own < 0.3;
      const keepTouching = group.parts.length > 0 && INTERIOR_STEP.test(group.name) && own >= MIN_NEW_INK;
      if (keepTouching || (fresh >= MIN_NEW_INK && !(steps.length > 0 && mostlyThere))) {
        pushContours(group, shown, false);
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

export function guidePaths(group: TutorialGroup, id: string): GuidePath[] {
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

export function loadRegions(input: {
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

export function appendFlatColours(
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
    const label = nameRegion(mapped.points, parts, spoken);
    if (isBackgroundPart(label)) continue;
    if (smallMassColour(label, parts, spoken, area, subject)) continue;
    prepared.push({
      label,
      colour: region.name,
      hex: region.hex,
      pixels: region.pixels,
      path: mapped.path,
      area,
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

export function keepColourRegions(regions: readonly FlatRegion[]): FlatRegion[] {
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

export function coffeePair(left: string, right: string): boolean {
  return COFFEE_COLOURS.has(left) && COFFEE_COLOURS.has(right) && left !== right;
}

export function collapseDoublePaint(regions: Array<{ label: string; colour: string; hex: string; pixels: number; path: string; area: number }>): typeof regions {
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
 * The part that owns the region: the smallest planned part whose box contains
 * the region's centroid. A part far smaller than the paint is skipped, so a
 * mouth does not rename the whole face. Background props are not names.
 */
export function nameRegion(points: readonly Point[], parts: readonly DetectedPart[], spoken: string): string {
  const center = centroidOf(points);
  const regionArea = Math.max(1, boxOf(points).area);
  let best: DetectedPart | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    if (isBackgroundPart(part.name)) continue;
    if (!containsPoint(part, center)) continue;
    const area = areaOf(part);
    if (area < regionArea * 0.4) continue;
    if (area < bestArea) {
      best = part;
      bestArea = area;
    }
  }
  const named = best ? plainNoun(bareName(best.name)) : '';
  return named || spoken;
}

/** A small patch whose only name is the whole subject is a colour the line drawing does not have. */
export function smallMassColour(
  label: string,
  parts: readonly DetectedPart[],
  spoken: string,
  area: number,
  subject: Box,
): boolean {
  if (subject.area <= 0 || area >= subject.area * 0.18 || area >= 22000) return false;
  const noun = stepNoun(label);
  if (!noun) return false;
  const usable = parts.filter((part) => !isBackgroundPart(part.name));
  const largest = usable.reduce((best, part) => Math.max(best, areaOf(part)), 0);
  const own = usable.find((part) => stepNoun(part.name) === noun);
  const ownArea = own ? areaOf(own) : largest;
  return noun === stepNoun(spoken) || ownArea >= largest * 0.98;
}

export function pruneDetails(
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

/** One connected cup-and-saucer silhouette becomes two outline steps. */
export function splitCupSaucer(main: MappedContour, parts: readonly DetectedPart[]): MappedContour[] | null {
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
  return [cupContour, visibleSaucer(saucerContour, [cup])];
}

/** The arc of the saucer that sits behind the cup is not a line the child draws. */
export function visibleSaucer(contour: MappedContour, parts: readonly DetectedPart[]): MappedContour {
  const cup = parts.find((part) => stepNoun(part.name) === 'cangkir');
  if (!cup) return contour;
  const lip = cup.y + cup.height - Math.max(10, cup.height * 0.08);
  const kept = contour.points.filter((point) => point.y >= lip || !containsPoint(cup, point));
  if (kept.length < 4 || kept.length === contour.points.length) return contour;
  return closeContour(kept, contour.id) ?? contour;
}
