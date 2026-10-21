/**
 * Photo bytes to a validated lesson. Used by the Worker and by photo-eval.
 *
 * The source photo is an argument, not a stored file. Callers must not log it.
 * The illustration is flattened onto white before it is hashed or traced.
 */

import { compareLessonToInk } from './compare';
import { dominantColors } from './colors';
import { downscaleLongEdge, flattenOnWhite } from './image-ops';
import { buildPhotoLesson, outlineCoverage, sanitizeTitle, shouldRedraw } from './lesson-build';
import { sumUsage, type ImageEditor, type InstructionResult, type InstructionWriter, type TokenUsage } from './openai';
import { decodePng, encodePng, type RgbaImage } from './png';
import type { ImageProvider } from './provider';
import { imageModelFor, imageQualityFor, type ImageQuality, type PhotoVariant } from './prompts';
import { replicateModelFor } from './replicate';
import type { Contour } from './trace';
import { traceInk } from './trace';

export interface PhotoPipelineInput {
  readonly png: Uint8Array;
  readonly variant: PhotoVariant;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
  readonly configuredImageModel?: string;
  readonly textModel: string;
  readonly lessonId: string;
  readonly provider?: ImageProvider;
}

export interface PhotoPipelineResult {
  readonly illustrationPng: Uint8Array;
  readonly dominantColors: readonly string[];
  readonly lesson: ReturnType<typeof buildPhotoLesson>['lesson'];
  readonly targetHash: string;
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
  readonly model: string;
  readonly quality: ImageQuality;
  readonly coverage: number;
  readonly subjectFit: number;
  readonly imageUsage: TokenUsage | null;
  readonly textUsage: TokenUsage | null;
}

interface TracedEdit {
  readonly illustration: RgbaImage;
  readonly png: Uint8Array;
  readonly targetHash: string;
  readonly contours: readonly Contour[];
  readonly usage: TokenUsage | null;
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
  let traced = await editTraced(deps.images, input, photo, model, quality, false, false, input.idempotencyKey);
  let imageUsage = traced.usage;
  let retried = false;
  if (shouldRedraw(outlineCoverage(traced.contours))) {
    const second = await editTraced(deps.images, input, photo, model, quality, true, false, `${input.idempotencyKey}-redraw`).catch(() => null);
    retried = true;
    if (second) {
      imageUsage = sumUsage(imageUsage, second.usage);
      if (outlineCoverage(second.contours) >= outlineCoverage(traced.contours)) traced = second;
    }
  }

  let written = await askParts(deps.instructions, input, traced, photoPng, '');
  let textUsage = written?.usage ?? null;
  if (written && !written.sameSubject && !retried) {
    const second = await editTraced(deps.images, input, photo, model, quality, true, true, `${input.idempotencyKey}-redraw`).catch(() => null);
    retried = true;
    if (second) {
      imageUsage = sumUsage(imageUsage, second.usage);
      const again = await askParts(deps.instructions, input, second, photoPng, '-redraw');
      textUsage = sumUsage(textUsage, again?.usage ?? null);
      traced = second;
      if (again) written = again;
    }
  }

  let built = lessonFrom(input, traced, photo, palette, written);
  let comparison = compareLessonToInk(built.lesson, traced.illustration);
  if (!retried && (comparison.needsReview || built.needsReview)) {
    const second = await editTraced(
      deps.images,
      input,
      photo,
      model,
      quality,
      true,
      written?.sameSubject === false,
      `${input.idempotencyKey}-redraw`,
    ).catch(() => null);
    if (second) {
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

  const subjectMismatch = written?.sameSubject === false;
  const reasons = [comparison.reviewReason, built.reviewReason];
  if (subjectMismatch) reasons.push('Gambar tidak sama dengan foto. Cek dulu sebelum dipakai.');
  const review = reasons.filter((reason): reason is string => reason !== null && reason !== undefined);
  return {
    illustrationPng: traced.png,
    dominantColors: palette,
    lesson: built.lesson,
    targetHash: traced.targetHash,
    needsReview: comparison.needsReview || built.needsReview || subjectMismatch,
    reviewReason: review.length > 0 ? review.join(' ') : null,
    model,
    quality,
    coverage: built.coverage,
    subjectFit: built.subjectFit,
    imageUsage,
    textUsage,
  };
}

async function editTraced(
  images: ImageEditor,
  input: PhotoPipelineInput,
  photo: RgbaImage,
  model: string,
  quality: ImageQuality,
  reinforceSilhouette: boolean,
  reinforceSubject: boolean,
  idempotencyKey: string,
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
  });
  const traced = await traceEdited(edited.png);
  return { ...traced, usage: edited.usage };
}

async function askParts(
  instructions: InstructionWriter | undefined,
  input: PhotoPipelineInput,
  traced: TracedEdit,
  photoPng: Uint8Array,
  suffix: string,
): Promise<InstructionResult | null> {
  if (!instructions) return null;
  try {
    const preview = await encodePng(downscaleLongEdge(traced.illustration, 512));
    return await instructions.write({
      model: input.textModel,
      photoPng,
      illustrationPng: preview,
      signal: input.signal,
      idempotencyKey: `${input.idempotencyKey}${suffix}`,
    });
  } catch {
    return null;
  }
}

function lessonFrom(
  input: PhotoPipelineInput,
  traced: TracedEdit,
  photo: RgbaImage,
  palette: readonly string[],
  written: InstructionResult | null,
): ReturnType<typeof buildPhotoLesson> {
  const title = written ? lessonTitle(written.title, written.subject) : 'Dari foto';
  const parts = written?.sameSubject ? written.parts : undefined;
  return buildPhotoLesson({
    id: input.lessonId,
    title,
    targetHash: traced.targetHash,
    contours: traced.contours,
    sourceWidth: traced.illustration.width,
    sourceHeight: traced.illustration.height,
    photo,
    palette,
    ...(parts && parts.length > 0 ? { parts } : {}),
  });
}

async function traceEdited(png: Uint8Array): Promise<TracedEdit> {
  const illustration = flattenOnWhite(await decodePng(png));
  const encoded = await encodePng(illustration);
  return {
    illustration,
    png: encoded,
    targetHash: await sha256Hex(encoded),
    contours: traceInk(illustration),
    usage: null,
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
