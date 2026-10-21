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
import { buildNamedLesson, buildTutorialLesson, lessonPieces, outlineCoverage, sanitizeTitle, shouldRedraw, type BuiltLesson } from './lesson-build';
import { sumUsage, type ImageEditor, type InstructionResult, type InstructionWriter, type TokenUsage } from './openai';
import { decodePng, encodePng, type RgbaImage } from './png';
import type { ImageProvider } from './provider';
import { cleanPartName } from './parts';
import { erasePrompt, imageModelFor, imageQualityFor, type ImageQuality, type PhotoVariant } from './prompts';
import { replicateModelFor } from './replicate';
import { MAX_REVERSE_ERASES, subtractInk } from './reverse';
import type { Contour } from './trace';
import { traceInk } from './trace';
import type { LessonPackage } from '../lesson-data/schema';

/** Strokes assign call A's ink. Reverse erases one part at a time. Both keeps strokes as the lesson. */
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
  /** Default is stroke assignment, two image calls. Reverse is a harness compare. */
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
  /** Present when `stepMode` is `reverse` or `both` and the erase pass produced a lesson. */
  readonly reverseLesson: LessonPackage | null;
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
  if (shouldRedraw(outlineCoverage(traced.contours))) {
    const second = await drawPass(deps.images, input, photo, model, quality, true, false, `${input.idempotencyKey}-redraw`, hints).catch(() => null);
    retried = true;
    if (second) {
      pairCalls += second.calls;
      imageUsage = sumUsage(imageUsage, second.usage);
      if (outlineCoverage(second.contours) >= outlineCoverage(traced.contours)) traced = second;
    }
  }

  let written = await askParts(deps.instructions, input, traced, photoPng, '');
  textUsage = sumUsage(textUsage, written?.usage ?? null);
  if (written && mismatchesPhoto(written) && !retried) {
    const second = await drawPass(deps.images, input, photo, model, quality, true, true, `${input.idempotencyKey}-redraw`, hints).catch(() => null);
    retried = true;
    if (second) {
      pairCalls += second.calls;
      imageUsage = sumUsage(imageUsage, second.usage);
      const again = await askParts(deps.instructions, input, second, photoPng, '-redraw');
      textUsage = sumUsage(textUsage, again?.usage ?? null);
      traced = second;
      if (again) written = again;
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

  const mode = input.stepMode ?? 'strokes';
  let reverseLesson: LessonPackage | null = null;
  let reverseStages: Uint8Array[] = [];
  if (mode !== 'strokes' && built.planNames.length >= 2) {
    const erased = await eraseBackwards(
      deps.images,
      input,
      traced,
      model,
      built.planNames,
      built.lesson.title,
      written?.sameSubject ? written.parts : [],
    );
    extraCalls += erased.calls;
    reverseCalls = erased.calls;
    reverseUsage = erased.usage;
    imageUsage = sumUsage(imageUsage, erased.usage);
    reverseStages = erased.stages;
    const staged = erased.lesson;
    if (staged) reverseLesson = staged.lesson;
    if (mode === 'reverse' && staged) {
      built = staged;
      comparison = compareLessonToInk(staged.lesson, traced.illustration);
    }
  }

  const subjectMismatch = written?.sameSubject === false;
  const extraSubject = (written?.extraObjects?.length ?? 0) > 0;
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
    reverseLesson: mode === 'reverse' ? null : reverseLesson,
    reverseStages,
    reverseCalls,
    reverseUsage,
  };
}

function mismatchesPhoto(written: InstructionResult | null): boolean {
  if (!written) return false;
  if (written.sameSubject === false) return true;
  if (written.samePose === false) return true;
  return (written.extraObjects?.length ?? 0) > 0;
}

function hintNames(written: InstructionResult | null): string[] {
  if (!written) return [];
  const names: string[] = [];
  for (const part of written.parts) {
    const name = cleanPartName(part.name);
    if (!name || names.includes(name)) continue;
    names.push(name);
    if (names.length === 8) break;
  }
  return names;
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
  const tail = planNames.slice(1).slice(-MAX_REVERSE_ERASES);
  const backward: Uint8Array[] = [traced.png];
  let current = traced.png;
  let calls = 0;
  let usage: TokenUsage | null = null;
  for (let index = tail.length - 1; index >= 0; index -= 1) {
    const name = tail[index] ?? '';
    try {
      const edited = await images.edit({
        png: current,
        variant: input.variant,
        model,
        quality: 'low',
        width: traced.illustration.width,
        height: traced.illustration.height,
        idempotencyKey: `${input.idempotencyKey}-erase-${tail.length - index}`,
        signal: input.signal,
        instruction: erasePrompt(name),
      });
      calls += 1;
      usage = sumUsage(usage, edited.usage);
      current = edited.png;
      backward.push(current);
    } catch {
      break;
    }
  }
  const forward = [...backward].reverse();
  if (forward.length !== tail.length + 1) return { stages: forward, calls, usage, lesson: null };
  const imagesInOrder: RgbaImage[] = [];
  for (const png of forward) {
    try {
      imagesInOrder.push(flattenOnWhite(await decodePng(png)));
    } catch {
      return { stages: forward, calls, usage, lesson: null };
    }
  }
  const labels = [planNames[0] ?? 'bentuk', ...tail];
  const stages: { name: string; contours: Contour[] }[] = [];
  for (let index = 0; index < imagesInOrder.length; index += 1) {
    const image = imagesInOrder[index];
    const previous = imagesInOrder[index - 1];
    if (!image) continue;
    const ink = index === 0 || !previous ? image : subtractInk(previous, image);
    if (!ink) return { stages: forward, calls, usage, lesson: null };
    const contours = traceInk(ink).filter((contour) => contour.points.length >= 2);
    const name = labels[index] ?? 'bagian';
    if (contours.length === 0) return { stages: forward, calls, usage, lesson: null };
    stages.push({ name, contours });
  }
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
  return { stages: forward, calls, usage, lesson };
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
