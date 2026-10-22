/**
 * The browser side of POST /api/photo-match. The lesson geometry stays in
 * the app. The response is only the category, the facing, and the colours.
 */

import { applyPhotoToLesson } from '../categories/apply';
import { doneCategory } from '../categories/library';
import { NO_MATCH_MESSAGE } from '../categories/match';
import type { Facing } from '../categories/types';
import type { LessonPackage } from '../lesson-data/schema';

export interface ClientMatch {
  readonly matched: boolean;
  readonly category: string;
  readonly confidence: number;
  readonly facing: Facing;
  readonly pose: string;
  readonly colours: readonly { readonly part: string; readonly color: string }[];
  readonly suggestions: readonly { readonly category: string; readonly title: string }[];
  readonly message: string;
}

/** Longest side of a photo sent to the matcher. Phone pictures are several megabytes. */
export const MATCH_PHOTO_LONG_EDGE = 1024;

/** JPEG quality for that upload. High enough that part colours stay readable. */
export const MATCH_JPEG_QUALITY = 0.85;

const UNREADABLE_PHOTO = 'Foto tidak dapat dibaca. Pilih gambar lain.';

export function fittedSize(width: number, height: number, longEdge = MATCH_PHOTO_LONG_EDGE): { readonly width: number; readonly height: number } {
  const longest = Math.max(width, height);
  if (longest <= longEdge) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const scale = longEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function matchPhotoRequest(file: File, signal?: AbortSignal): Promise<ClientMatch> {
  const photo = await downscaleMatchPhoto(file);
  const response = await fetch('/api/photo-match', {
    method: 'POST',
    headers: {
      'content-type': 'image/jpeg',
      'idempotency-key': crypto.randomUUID(),
    },
    body: photo,
    ...(signal ? { signal } : {}),
  });
  const payload = await response.json() as unknown;
  if (!response.ok) {
    const record = payload !== null && typeof payload === 'object' ? payload as { error?: unknown } : {};
    throw new Error(typeof record.error === 'string' ? record.error : 'Foto ini belum bisa dipakai. Coba lagi ya.');
  }
  return readClientMatch(payload);
}

async function downscaleMatchPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(UNREADABLE_PHOTO);
  }
  try {
    const size = fittedSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(UNREADABLE_PHOTO);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value);
        else reject(new Error(UNREADABLE_PHOTO));
      }, 'image/jpeg', MATCH_JPEG_QUALITY);
    });
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}

export function lessonFromMatch(match: ClientMatch): LessonPackage | null {
  if (!match.matched) return null;
  const entry = doneCategory(match.category);
  if (!entry) return null;
  return applyPhotoToLesson(entry, { facing: match.facing, colours: match.colours });
}

export function readClientMatch(payload: unknown): ClientMatch {
  const record = payload !== null && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const facing = record.facing;
  return {
    matched: record.matched === true,
    category: typeof record.category === 'string' ? record.category : 'none',
    confidence: typeof record.confidence === 'number' ? record.confidence : 0,
    facing: facing === 'left' || facing === 'right' || facing === 'front' || facing === 'unknown' ? facing : 'unknown',
    pose: typeof record.pose === 'string' ? record.pose : '',
    colours: Array.isArray(record.colours)
      ? record.colours.flatMap((item) => {
        if (item === null || typeof item !== 'object') return [];
        const colour = item as { part?: unknown; color?: unknown };
        if (typeof colour.part !== 'string' || typeof colour.color !== 'string') return [];
        return [{ part: colour.part, color: colour.color }];
      })
      : [],
    suggestions: Array.isArray(record.suggestions)
      ? record.suggestions.flatMap((item) => {
        if (item === null || typeof item !== 'object') return [];
        const suggestion = item as { category?: unknown; title?: unknown };
        if (typeof suggestion.category !== 'string' || typeof suggestion.title !== 'string') return [];
        return [{ category: suggestion.category, title: suggestion.title }];
      })
      : [],
    message: typeof record.message === 'string' && record.message ? record.message : NO_MATCH_MESSAGE,
  };
}
