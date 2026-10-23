/**
 * Browser call to POST /api/photo-lesson.
 *
 * The photo bytes go in the body and nowhere else. A retry of the same job
 * reuses `idempotencyKey`. A new picture, or "Lebih mirip" / "Lebih sederhana",
 * is a new key and may be a new billed edit.
 */

import type { LessonPackage } from '../lesson-data/schema';
import { findLessonProblems } from '../lesson-data/validate';
import { base64ToBytes } from './bytes';
import { PHOTO_API_PATH } from './paths';
import type { PhotoVariant } from './prompts';

export interface PhotoLessonRequest {
  readonly png: Uint8Array;
  readonly idempotencyKey: string;
  readonly variant: PhotoVariant;
  readonly signal: AbortSignal;
}

export interface PhotoLessonApiResult {
  readonly illustrationPng: Uint8Array;
  readonly dominantColors: readonly string[];
  readonly lesson: LessonPackage;
  readonly targetHash: string;
  readonly needsReview: boolean;
  readonly reviewReason: string | null;
  readonly model: string;
}

const FALLBACK = 'Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.';

export async function requestPhotoLesson(input: PhotoLessonRequest): Promise<PhotoLessonApiResult> {
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(450_000)]);
  const form = new FormData();
  form.set('image', new File([copyBytes(input.png)], 'photo.png', { type: 'image/png' }));
  form.set('idempotencyKey', input.idempotencyKey);
  form.set('variant', input.variant);
  const response = await fetch(PHOTO_API_PATH, { method: 'POST', body: form, signal });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record = asRecord(payload);
    throw new Error(typeof record.error === 'string' ? record.error : FALLBACK);
  }
  return parseResult(payload);
}

function parseResult(payload: unknown): PhotoLessonApiResult {
  const record = asRecord(payload);
  const b64 = typeof record.illustrationPng === 'string' ? record.illustrationPng : '';
  const lesson = record.lesson as LessonPackage;
  const targetHash = typeof record.targetHash === 'string' ? record.targetHash : '';
  if (!b64 || !lesson || !targetHash) throw new Error(FALLBACK);
  if (findLessonProblems(lesson).length > 0) {
    throw new Error('Pelajaran dari foto tidak lolos pemeriksaan.');
  }
  return {
    illustrationPng: base64ToBytes(b64),
    dominantColors: Array.isArray(record.dominantColors)
      ? record.dominantColors.filter((color): color is string => typeof color === 'string')
      : [],
    lesson,
    targetHash,
    needsReview: record.needsReview === true,
    reviewReason: typeof record.reviewReason === 'string' ? record.reviewReason : null,
    model: typeof record.model === 'string' ? record.model : '',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
