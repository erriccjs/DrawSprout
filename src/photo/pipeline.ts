/**
 * Photo bytes to a validated lesson. Used by the Worker and by photo-eval.
 *
 * The source photo is an argument, not a stored file. Callers must not log it.
 */

import { compareLessonToInk } from './compare';
import { dominantColors } from './colors';
import { downscaleLongEdge } from './image-ops';
import { buildPhotoLesson, sanitizeTitle } from './lesson-build';
import type { ImageEditor, InstructionWriter, TokenUsage } from './openai';
import { decodePng, encodePng } from './png';
import { imageModelFor, imageQualityFor, type ImageQuality, type PhotoVariant } from './prompts';
import { traceInk } from './trace';

export interface PhotoPipelineInput {
  readonly png: Uint8Array;
  readonly variant: PhotoVariant;
  readonly idempotencyKey: string;
  readonly signal: AbortSignal;
  readonly configuredImageModel?: string;
  readonly textModel: string;
  readonly lessonId: string;
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
  readonly imageUsage: TokenUsage | null;
  readonly textUsage: TokenUsage | null;
}

export async function runPhotoPipeline(
  input: PhotoPipelineInput,
  deps: { images: ImageEditor; instructions?: InstructionWriter },
): Promise<PhotoPipelineResult> {
  const photo = await decodePng(input.png);
  const palette = dominantColors(photo);
  const model = imageModelFor(input.variant, input.configuredImageModel);
  const quality = imageQualityFor(input.variant);
  const edited = await deps.images.edit({
    png: input.png,
    variant: input.variant,
    model,
    quality,
    width: photo.width,
    height: photo.height,
    idempotencyKey: input.idempotencyKey,
    signal: input.signal,
  });
  const illustration = await decodePng(edited.png);
  const contours = traceInk(illustration);
  const targetHash = await sha256Hex(edited.png);
  let title = 'Dari foto';
  let textUsage: TokenUsage | null = null;
  let instructionMap = new Map<string, string>();
  const draft = buildPhotoLesson({
    id: input.lessonId,
    title,
    targetHash,
    contours,
    sourceWidth: illustration.width,
    sourceHeight: illustration.height,
    photo,
    palette,
  });
  if (deps.instructions) {
    try {
      const preview = await encodePng(downscaleLongEdge(illustration, 512));
      const written = await deps.instructions.write({
        model: input.textModel,
        steps: draft.briefs,
        illustrationPng: preview,
        signal: input.signal,
        idempotencyKey: input.idempotencyKey,
      });
      title = lessonTitle(written.title, written.subject);
      instructionMap = new Map(written.instructions);
      textUsage = written.usage;
    } catch {
      // The fixed sentences already on the draft stay. A text-model failure
      // must not discard a picture the parent can still review.
    }
  }
  const built = instructionMap.size === 0 && title === 'Dari foto'
    ? draft
    : buildPhotoLesson({
      id: input.lessonId,
      title,
      targetHash,
      contours,
      sourceWidth: illustration.width,
      sourceHeight: illustration.height,
      photo,
      palette,
      instructions: instructionMap,
    });
  const comparison = compareLessonToInk(built.lesson, illustration);
  const reasons = [comparison.reviewReason, built.reviewReason].filter((reason): reason is string => reason !== null);
  return {
    illustrationPng: edited.png,
    dominantColors: palette,
    lesson: built.lesson,
    targetHash,
    needsReview: comparison.needsReview || built.needsReview,
    reviewReason: reasons.length > 0 ? reasons.join(' ') : null,
    model,
    quality,
    coverage: built.coverage,
    imageUsage: edited.usage,
    textUsage,
  };
}

function lessonTitle(title: string, subject: string): string {
  const fromTitle = sanitizeTitle(title);
  if (fromTitle !== 'Dari foto' && !rejectsTitle(fromTitle)) return fromTitle;
  const fromSubject = sanitizeTitle(subject);
  if (fromSubject !== 'Dari foto' && !rejectsTitle(fromSubject)) return fromSubject;
  return 'Dari foto';
}

function rejectsTitle(text: string): boolean {
  return /latar belakang|wajah anak/i.test(text);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
