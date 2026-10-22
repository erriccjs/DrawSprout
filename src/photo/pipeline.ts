/**
 * Photo bytes to a validated lesson. Used by the Worker and by photo-eval.
 *
 * The source photo is an argument, not a stored file. Callers must not log it.
 * The illustration is flattened onto white before it is hashed or traced.
 */

import { compareLessonToInk } from './compare';
import { dominantColors } from './colors';
import { regionsColouredBy, type FlatRegion } from './flat-colour';
import { downscaleLongEdge, flattenOnWhite } from './image-ops';
import { buildNamedLesson, buildTutorialLesson, imageRect, isBackgroundPart, lessonPieces, outlineCoverage, partNoun, sanitizeTitle, shouldRedraw, type BuiltLesson } from './lesson-build';
import { sumUsage, type ImageEditor, type InstructionResult, type InstructionWriter, type TokenUsage } from './openai';
import { decodePng, encodePng, type RgbaImage } from './png';
import type { ImageProvider } from './provider';
import { cleanPartName } from './parts';
import { erasePrompt, imageModelFor, imageQualityFor, type ImageQuality, type PhotoVariant } from './prompts';
import { replicateModelFor } from './replicate';
import { eraseDetailNames, inkAdded, MAX_REVERSE_ERASES, partErasedCleanly, registerToFinal, type InkRegion } from './reverse';
import type { Contour } from './trace';
import { traceInk } from './trace';
import type { LessonPackage } from '../lesson-data/schema';

/** Strokes assign call A's ink. Reverse erases one planned part at a time and is the lesson. Both keeps strokes beside it. */
export type PhotoStepMode = 'strokes' | 'reverse' | 'both';

export interface PhotoPipelineInput {
  readonly png: Uint8Array;
  readonly variant: PhotoVariant;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
  readonly configuredImageModel?: string;
  readonly textModel: string;
  readonly lessonId: string;
  readonly provider?: ImageProvider;
  /** Default is reverse. Strokes run only when `strokes` is set, or when the erase pass cannot build a lesson. */
  readonly stepMode?: PhotoStepMode;
}

export interface PhotoPipelineResult {
  readonly illustrationPng: Uint8Array;
  /** Line drawing. Drawing steps are traced from this. */
  readonly lineArtPng: Uint8Array;
  /** Flat colour painted onto the line drawing. Null when that call failed. */
  readonly colouredPng: Uint8Array | null;
  readonly dominantColors: readonly string[];
  readonly lesson: LessonPackage;
  readonly targetHash: string;
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
  readonly reviewReasons: readonly string[];
  readonly model: string;
  readonly quality: ImageQuality;
  readonly coverage: number;
  readonly subjectFit: number;
  readonly imageUsage: TokenUsage | null;
  readonly textUsage: TokenUsage | null;
  /** Successful image edits, including a colour pass, a redraw, and optional reverse erases. */
  readonly imageCalls: number;
  /** True when the line drawing was requested again after the first pair. Reverse erases do not set this. */
  readonly regenerated: boolean;
  readonly stepMode: PhotoStepMode;
  /** Stroke lesson when `stepMode` is `both` and reverse became the lesson. Otherwise null. */
  readonly reverseLesson: LessonPackage | null;
  /** Which builder produced `lesson`. Reverse falls back to strokes when no erase stage is usable. */
  readonly lessonSource: 'reverse' | 'strokes';
  /** Cumulative line drawings, simplest first. Empty unless reverse ran. */
  readonly reverseStages: readonly Uint8Array[];
  /** Low-quality erase edits. Zero unless reverse ran. Not part of `regenerated`. */
  readonly reverseCalls: number;
  /** Token usage of the erase edits only. Null when reverse did not run or the provider omits usage. */
  readonly reverseUsage: TokenUsage | null;
}

interface TracedEdit {
  readonly illustration: RgbaImage;
  readonly png: Uint8Array;
  readonly colouredPng: Uint8Array | null;
  readonly targetHash: string;
  readonly contours: readonly Contour[];
  readonly flatRegions: readonly FlatRegion[];
  readonly usage: TokenUsage | null;
  readonly calls: number;
}

export async function runPhotoPipeline(
  input: PhotoPipelineInput,
  deps: { images: ImageEditor; instructions?: InstructionWriter },
): Promise<PhotoPipelineResult> {
  const photo = await decodePng(input.png);
  const palette = dominantColors(photo);
  const provider = input.provider ?? 'openai';
  const model = provider === 'replicate'
    ? replicateModelFor(input.configuredImageModel)
    : imageModelFor(input.variant, input.configuredImageModel);
  const quality = imageQualityFor(input.variant);
  const photoPng = await encodePng(downscaleLongEdge(photo, 512));
  const photoPlan = await askPhotoPlan(deps.instructions, input, photoPng);
  let textUsage = photoPlan?.usage ?? null;
  const hints = hintNames(photoPlan);
  let pairCalls = 0;
  let extraCalls = 0;
  let reverseCalls = 0;
  let reverseUsage: TokenUsage | null = null;
  let traced = await drawPass(deps.images, input, photo, model, quality, false, false, input.idempotencyKey, hints);
  pairCalls += traced.calls;
  let imageUsage = traced.usage;
  let retried = false;

  let written = await askParts(deps.instructions, input, traced, photoPng, '');
  textUsage = sumUsage(textUsage, written?.usage ?? null);
  const thin = shouldRedraw(outlineCoverage(traced.contours));
  const mismatch = mismatchesPhoto(written);
  const props = hasBackgroundParts(written);
  if ((mismatch || props || thin) && !retried) {
    const second = await drawPass(
      deps.images,
      input,
      photo,
      model,
      quality,
      thin,
      mismatch || props,
      `${input.idempotencyKey}-redraw`,
      hints,
    ).catch(() => null);
    retried = true;
    if (second) {
      pairCalls += second.calls;
      imageUsage = sumUsage(imageUsage, second.usage);
      if (mismatch || props || outlineCoverage(second.contours) >= outlineCoverage(traced.contours)) {
        const again = await askParts(deps.instructions, input, second, photoPng, '-redraw');
        textUsage = sumUsage(textUsage, again?.usage ?? null);
        traced = second;
        if (again) written = again;
      }
    }
  }

  let built = lessonFrom(input, traced, photo, palette, written);
  let comparison = compareLessonToInk(built.lesson, traced.illustration);
  if (!retried && (comparison.needsReview || shouldRedraw(built.coverage))) {
    const second = await drawPass(
      deps.images,
      input,
      photo,
      model,
      quality,
      true,
      mismatchesPhoto(written),
      `${input.idempotencyKey}-redraw`,
      hints,
    ).catch(() => null);
    if (second) {
      pairCalls += second.calls;
      imageUsage = sumUsage(imageUsage, second.usage);
      const again = await askParts(deps.instructions, input, second, photoPng, '-redraw');
      textUsage = sumUsage(textUsage, again?.usage ?? null);
      const rebuilt = lessonFrom(input, second, photo, palette, again ?? written);
      const recompared = compareLessonToInk(rebuilt.lesson, second.illustration);
      if (rebuilt.coverage + recompared.dice >= built.coverage + comparison.dice) {
        traced = second;
        built = rebuilt;
        comparison = recompared;
        if (again) written = again;
      }
    }
  }

  if (deps.instructions && built.unnamedInteriors > 0 && interiorContours(traced.contours) >= 2) {
    const labeled = await askParts(deps.instructions, input, traced, photoPng, '-labels', true);
    if (labeled) {
      textUsage = sumUsage(textUsage, labeled.usage);
      const rebuilt = lessonFrom(input, traced, photo, palette, labeled);
      if (rebuilt.unnamedInteriors < built.unnamedInteriors) {
        built = rebuilt;
        written = labeled;
      }
    }
  }

  const mode = input.stepMode ?? 'reverse';
  const strokeBuilt = built;
  let reverseLesson: LessonPackage | null = null;
  let reverseStages: Uint8Array[] = [];
  let lessonSource: 'reverse' | 'strokes' = 'strokes';
  const visionParts = written?.sameSubject ? written.parts : [];
  const plannedErase = eraseDetailNames(visionParts).details.length;
  if (mode !== 'strokes' && (plannedErase >= 1 || built.planNames.length >= 2)) {
    const erased = await eraseBackwards(
      deps.images,
      input,
      traced,
      model,
      built.planNames,
      built.lesson.title,
      visionParts,
    );
    extraCalls += erased.calls;
    reverseCalls = erased.calls;
    reverseUsage = erased.usage;
    imageUsage = sumUsage(imageUsage, erased.usage);
    reverseStages = erased.stages;
    const staged = erased.lesson;
    if (staged) {
      built = staged;
      lessonSource = 'reverse';
      comparison = compareLessonToInk(staged.lesson, traced.illustration);
      if (mode === 'both') reverseLesson = strokeBuilt.lesson;
    }
  }

  const subjectMismatch = written?.sameSubject === false;
  const extraSubject = objectionableExtras(written).length > 0 || hasBackgroundParts(written);
  const poseMismatch = written?.samePose === false;
  const reasons = [...built.reviewReasons];
  if (comparison.reviewReason) reasons.push(comparison.reviewReason);
  if (extraSubject) reasons.push('Gambar menambah benda yang tidak ada di foto. Cek dulu sebelum dipakai.');
  if (poseMismatch) reasons.push('Pose atau bingkai gambar tidak sama dengan foto. Cek dulu sebelum dipakai.');
  if (subjectMismatch) reasons.push('Gambar tidak sama dengan foto. Cek dulu sebelum dipakai.');
  const shown = traced.colouredPng ?? traced.png;
  return {
    illustrationPng: shown,
    lineArtPng: traced.png,
    colouredPng: traced.colouredPng,
    dominantColors: palette,
    lesson: built.lesson,
    targetHash: shown === traced.png ? traced.targetHash : await sha256Hex(shown),
    needsReview: reasons.length > 0,
    reviewReason: reasons.length > 0 ? reasons.join(' ') : null,
    reviewReasons: reasons,
    model,
    quality,
    coverage: built.coverage,
    subjectFit: built.subjectFit,
    imageUsage,
    textUsage,
    imageCalls: pairCalls + extraCalls,
    regenerated: pairCalls > 2,
    stepMode: mode,
    reverseLesson,
    lessonSource,
    reverseStages,
    reverseCalls,
    reverseUsage,
  };
}

const BENIGN_EXTRA = /^(latar|latar belakang|latar foto|bayangan|kertas|putih|background)$/;

function objectionableExtras(written: InstructionResult | null): string[] {
  if (!written) return [];
  const subject = partNoun(written.subject).toLowerCase();
  const planned = new Set(written.parts.map((part) => partNoun(part.name).toLowerCase()));
  const extras: string[] = [];
  for (const name of written.extraObjects ?? []) {
    const noun = partNoun(name).toLowerCase();
    if (!noun || BENIGN_EXTRA.test(noun)) continue;
    if (subject && (noun === subject || noun.includes(subject) || subject.includes(noun))) continue;
    if (planned.has(noun)) continue;
    extras.push(noun);
  }
  return extras;
}

function mismatchesPhoto(written: InstructionResult | null): boolean {
  if (!written) return false;
  if (written.sameSubject === false) return true;
  if (written.samePose === false) return true;
  return objectionableExtras(written).length > 0;
}

function hintNames(written: InstructionResult | null): string[] {
  if (!written) return [];
  const names: string[] = [];
  for (const part of written.parts) {
    const name = cleanPartName(part.name);
    if (!name || names.includes(name) || isBackgroundPart(name)) continue;
    names.push(name);
    if (names.length === 8) break;
  }
  return names;
}

function hasBackgroundParts(written: InstructionResult | null): boolean {
  return written?.parts.some((part) => isBackgroundPart(part.name)) === true;
}

async function askPhotoPlan(
  instructions: InstructionWriter | undefined,
  input: PhotoPipelineInput,
  photoPng: Uint8Array,
): Promise<InstructionResult | null> {
  if (!instructions) return null;
  try {
    return await instructions.write({
      model: input.textModel,
      photoPng,
      illustrationPng: photoPng,
      signal: input.signal,
      idempotencyKey: `${input.idempotencyKey}-plan`,
      photoOnly: true,
    });
  } catch {
    return null;
  }
}

async function eraseBackwards(
  images: ImageEditor,
  input: PhotoPipelineInput,
  traced: TracedEdit,
  model: string,
  planNames: readonly string[],
  title: string,
  parts: InstructionResult['parts'],
): Promise<{ stages: Uint8Array[]; calls: number; usage: TokenUsage | null; lesson: BuiltLesson | null }> {
  const planned = eraseDetailNames(parts);
  const fallback = planNames
    .slice(1)
    .map((name) => partNoun(name))
    .filter((name, index, all) => name.length > 0 && all.indexOf(name) === index && !isBackgroundPart(name));
  const details = [...(planned.details.length > 0 ? planned.details : fallback)].slice(0, MAX_REVERSE_ERASES);
  const massName = planned.mass || partNoun(planNames[0] ?? '') || 'bentuk';
  let current = traced.png;
  let calls = 0;
  let usage: TokenUsage | null = null;
  const undone: { name: string; png: Uint8Array }[] = [];
  let ordinal = 0;
  for (let index = details.length - 1; index >= 0; index -= 1) {
    const name = details[index] ?? '';
    if (!name || calls >= MAX_REVERSE_ERASES) break;
    ordinal += 1;
    const region = addedRegion(name, parts, traced.illustration.width, traced.illustration.height);
    if (!region) continue;
    const erased = await eraseOnePart(
      images,
      input,
      traced,
      model,
      current,
      name,
      region,
      MAX_REVERSE_ERASES - calls,
      `${input.idempotencyKey}-erase-${ordinal}`,
    );
    calls += erased.calls;
    usage = sumUsage(usage, erased.usage);
    if (!erased.png) continue;
    undone.push({ name, png: current });
    current = erased.png;
  }
  const forwardPng = [current, ...[...undone].reverse().map((step) => step.png)];
  const labels = [massName, ...[...undone].reverse().map((step) => step.name)];
  if (forwardPng.length < 2) return { stages: forwardPng, calls, usage, lesson: null };
  const imagesInOrder: RgbaImage[] = [];
  for (const png of forwardPng) {
    try {
      imagesInOrder.push(flattenOnWhite(await decodePng(png)));
    } catch {
      return { stages: forwardPng, calls, usage, lesson: null };
    }
  }
  const final = imagesInOrder[imagesInOrder.length - 1];
  if (!final) return { stages: forwardPng, calls, usage, lesson: null };
  const aligned = imagesInOrder.map((image) => registerToFinal(final, image));
  const stages: { name: string; contours: Contour[] }[] = [];
  for (let index = 0; index < aligned.length; index += 1) {
    const image = aligned[index];
    const previous = aligned[index - 1];
    if (!image) continue;
    const name = labels[index] ?? 'bagian';
    const region = index === 0 ? undefined : addedRegion(name, parts, final.width, final.height);
    const exclude = name === 'piring' ? occludedCup(parts, final.width, final.height) : undefined;
    const ink = index === 0 || !previous ? image : inkAdded(previous, image, region, exclude);
    if (!ink) continue;
    const contours = traceInk(ink).filter((contour) => contour.points.length >= 2);
    if (contours.length === 0) continue;
    stages.push({ name, contours });
  }
  if (stages.length < 2) return { stages: forwardPng, calls, usage, lesson: null };
  const lesson = buildNamedLesson({
    id: input.lessonId,
    title,
    targetHash: traced.targetHash,
    contours: traced.contours,
    sourceWidth: traced.illustration.width,
    sourceHeight: traced.illustration.height,
    photo: traced.illustration,
    palette: [],
    flatRegions: traced.flatRegions,
    ...(parts.length > 0 ? { parts } : {}),
    stages,
  });
  return { stages: forwardPng, calls, usage, lesson };
}

async function eraseOnePart(
  images: ImageEditor,
  input: PhotoPipelineInput,
  traced: TracedEdit,
  model: string,
  current: Uint8Array,
  name: string,
  region: InkRegion,
  budget: number,
  key: string,
): Promise<{ png: Uint8Array | null; calls: number; usage: TokenUsage | null }> {
  let instruction = erasePrompt(name);
  let calls = 0;
  let usage: TokenUsage | null = null;
  const attempts = Math.min(2, Math.max(0, budget));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const edited = await images.edit({
        png: current,
        variant: input.variant,
        model,
        quality: 'low',
        width: traced.illustration.width,
        height: traced.illustration.height,
        idempotencyKey: attempt === 0 ? key : `${key}b`,
        signal: input.signal,
        instruction,
      });
      calls += 1;
      usage = sumUsage(usage, edited.usage);
      const before = flattenOnWhite(await decodePng(current));
      const after = flattenOnWhite(await decodePng(edited.png));
      if (partErasedCleanly(before, after, region)) return { png: edited.png, calls, usage };
      instruction = erasePrompt(name, true);
    } catch {
      return { png: null, calls, usage };
    }
  }
  return { png: null, calls, usage };
}

async function drawPass(
  images: ImageEditor,
  input: PhotoPipelineInput,
  photo: RgbaImage,
  model: string,
  quality: ImageQuality,
  reinforceSilhouette: boolean,
  reinforceSubject: boolean,
  idempotencyKey: string,
  partHints: readonly string[],
): Promise<TracedEdit> {
  const edited = await images.edit({
    png: input.png,
    variant: input.variant,
    model,
    quality,
    width: photo.width,
    height: photo.height,
    idempotencyKey,
    signal: input.signal,
    ...(reinforceSilhouette ? { reinforceSilhouette: true } : {}),
    ...(reinforceSubject ? { reinforceSubject: true } : {}),
    ...(partHints.length > 0 ? { partHints } : {}),
  });
  const traced = await traceLine(edited.png);
  let usage = edited.usage;
  let calls = 1;
  let colouredPng: Uint8Array | null = null;
  let flatRegions: readonly FlatRegion[] = [];
  try {
    const coloured = await images.edit({
      png: traced.png,
      referencePng: input.png,
      variant: input.variant,
      model,
      quality: 'low',
      width: traced.illustration.width,
      height: traced.illustration.height,
      idempotencyKey: `${idempotencyKey}-colour`,
      signal: input.signal,
    });
    calls += 1;
    usage = sumUsage(usage, coloured.usage);
    const page = flattenOnWhite(await decodePng(coloured.png));
    colouredPng = await encodePng(page);
    flatRegions = regionsColouredBy(traced.illustration, page).regions;
  } catch {
    // The line drawing still becomes a lesson when the colour call fails.
  }
  return { ...traced, colouredPng, flatRegions, usage, calls };
}

async function askParts(
  instructions: InstructionWriter | undefined,
  input: PhotoPipelineInput,
  traced: TracedEdit,
  photoPng: Uint8Array,
  suffix: string,
  relabel = false,
): Promise<InstructionResult | null> {
  if (!instructions) return null;
  try {
    const preview = await encodePng(downscaleLongEdge(traced.illustration, 512));
    const pieces = lessonPieces(traced.contours, traced.illustration.width, traced.illustration.height);
    return await instructions.write({
      model: input.textModel,
      photoPng,
      illustrationPng: preview,
      signal: input.signal,
      idempotencyKey: `${input.idempotencyKey}${suffix}`,
      ...(pieces.length > 0 ? { pieces } : {}),
      ...(relabel ? { relabel: true } : {}),
    });
  } catch {
    return null;
  }
}

function addedRegion(
  name: string,
  parts: InstructionResult['parts'],
  sourceWidth: number,
  sourceHeight: number,
): InkRegion | undefined {
  const noun = partNoun(name);
  const matches = parts.filter((part) => partNoun(part.name) === noun);
  if (matches.length === 0 || !matches[0]) return undefined;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = 0;
  let maxY = 0;
  for (const part of matches) {
    const rect = imageRect(part, sourceWidth, sourceHeight);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return undefined;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The cup body, shortened so the saucer's front lip can still be new ink. */
function occludedCup(
  parts: InstructionResult['parts'],
  sourceWidth: number,
  sourceHeight: number,
): InkRegion | undefined {
  const cup = addedRegion('cangkir', parts, sourceWidth, sourceHeight);
  if (!cup) return undefined;
  return { x: cup.x, y: cup.y, width: cup.width, height: cup.height * 0.85 };
}

function interiorContours(contours: readonly Contour[]): number {
  return contours.filter((contour) => contour.silhouette !== true).length;
}

function lessonFrom(
  input: PhotoPipelineInput,
  traced: TracedEdit,
  photo: RgbaImage,
  palette: readonly string[],
  written: InstructionResult | null,
): BuiltLesson {
  const title = written ? lessonTitle(written.title, written.subject) : 'Dari foto';
  const parts = written?.sameSubject ? written.parts : undefined;
  return buildTutorialLesson({
    id: input.lessonId,
    title,
    targetHash: traced.targetHash,
    contours: traced.contours,
    sourceWidth: traced.illustration.width,
    sourceHeight: traced.illustration.height,
    photo,
    palette,
    flatRegions: traced.flatRegions,
    ...(parts && parts.length > 0 ? { parts } : {}),
  });
}

async function traceLine(png: Uint8Array): Promise<TracedEdit> {
  const illustration = flattenOnWhite(await decodePng(png));
  const encoded = await encodePng(illustration);
  const traced = traceInk(illustration);
  return {
    illustration,
    png: encoded,
    colouredPng: null,
    targetHash: await sha256Hex(encoded),
    contours: traced,
    flatRegions: [],
    usage: null,
    calls: 1,
  };
}

function lessonTitle(title: string, subject: string): string {
  const fromTitle = sanitizeTitle(title);
  if (fromTitle !== 'Dari foto') return fromTitle;
  const fromSubject = sanitizeTitle(subject);
  if (fromSubject !== 'Dari foto') return fromSubject;
  return 'Dari foto';
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
