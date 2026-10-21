/**
 * Photo bytes to a validated lesson. Used by the Worker and by photo-eval.
 *
 * The source photo is an argument, not a stored file. Callers must not log it.
 * The illustration is flattened onto white before it is hashed or traced.
 */

import { compareLessonToInk } from './compare';
import { dominantColors } from './colors';
import { downscaleLongEdge, flattenOnWhite } from './image-ops';
import { buildPhotoLesson, sanitizeTitle, shouldRedraw, type ShapeProposal } from './lesson-build';
import { sumUsage, type ImageEditor, type InstructionWriter, type TokenUsage } from './openai';
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
  const first = await deps.images.edit({
    png: input.png,
    variant: input.variant,
    model,
    quality,
    width: photo.width,
    height: photo.height,
    idempotencyKey: input.idempotencyKey,
    signal: input.signal,
  });
  let traced = await traceEdited(first.png);
  let imageUsage = first.usage;
  let draft = lessonFrom(input, traced, photo, palette, 'Dari foto');
  if (shouldRedraw(draft.subjectFit)) {
    try {
      const second = await deps.images.edit({
        png: input.png,
        variant: input.variant,
        model,
        quality,
        width: photo.width,
        height: photo.height,
        idempotencyKey: `${input.idempotencyKey}-silhouette`,
        signal: input.signal,
        reinforceSilhouette: true,
      });
      const retryTrace = await traceEdited(second.png);
      const retry = lessonFrom(input, retryTrace, photo, palette, 'Dari foto');
      imageUsage = sumUsage(imageUsage, second.usage);
      if (retry.subjectFit > draft.subjectFit) {
        traced = retryTrace;
        draft = retry;
      }
    } catch {
      // The first illustration stays. A failed redraw must not discard it.
    }
  }

  let title = 'Dari foto';
  let textUsage: TokenUsage | null = null;
  let proposals: readonly ShapeProposal[] | undefined;
  if (deps.instructions) {
    try {
      const preview = await encodePng(downscaleLongEdge(traced.illustration, 512));
      const written = await deps.instructions.write({
        model: input.textModel,
        targets: draft.targets,
        illustrationPng: preview,
        signal: input.signal,
        idempotencyKey: input.idempotencyKey,
      });
      title = lessonTitle(written.title, written.subject);
      proposals = written.parts;
      textUsage = written.usage;
    } catch {
      // Fixed shape sentences stay. A text-model failure must not discard the picture.
    }
  }
  const built = proposals && proposals.length > 0 || title !== 'Dari foto'
    ? lessonFrom(input, traced, photo, palette, title, proposals)
    : draft;
  const comparison = compareLessonToInk(built.lesson, traced.illustration);
  const reasons = [comparison.reviewReason, built.reviewReason].filter((reason): reason is string => reason !== null);
  return {
    illustrationPng: traced.png,
    dominantColors: palette,
    lesson: built.lesson,
    targetHash: traced.targetHash,
    needsReview: comparison.needsReview || built.needsReview,
    reviewReason: reasons.length > 0 ? reasons.join(' ') : null,
    model,
    quality,
    coverage: built.coverage,
    subjectFit: built.subjectFit,
    imageUsage,
    textUsage,
  };
}

function lessonFrom(
  input: PhotoPipelineInput,
  traced: TracedEdit,
  photo: RgbaImage,
  palette: readonly string[],
  title: string,
  proposals?: readonly ShapeProposal[],
): ReturnType<typeof buildPhotoLesson> {
  return buildPhotoLesson({
    id: input.lessonId,
    title,
    targetHash: traced.targetHash,
    contours: traced.contours,
    sourceWidth: traced.illustration.width,
    sourceHeight: traced.illustration.height,
    photo,
    palette,
    ...(proposals && proposals.length > 0 ? { proposals } : {}),
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
