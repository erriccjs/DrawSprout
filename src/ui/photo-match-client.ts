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

export async function matchPhotoRequest(file: File, signal?: AbortSignal): Promise<ClientMatch> {
  const response = await fetch('/api/photo-match', {
    method: 'POST',
    headers: {
      'content-type': file.type || 'image/jpeg',
      'idempotency-key': crypto.randomUUID(),
    },
    body: file,
    ...(signal ? { signal } : {}),
  });
  const payload = await response.json() as unknown;
  if (!response.ok) {
    const record = payload !== null && typeof payload === 'object' ? payload as { error?: unknown } : {};
    throw new Error(typeof record.error === 'string' ? record.error : 'Foto ini belum bisa dipakai. Coba lagi ya.');
  }
  return readClientMatch(payload);
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
