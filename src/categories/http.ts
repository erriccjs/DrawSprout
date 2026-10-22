/**
 * POST /api/photo-match.
 *
 * The body is the photo and is not written to the response or to logs.
 * A missing category or a low confidence returns the friendly list.
 */

import { interpretMatch, type PhotoMatch } from './match';
import type { ClassifyResult } from './openai';

export const PHOTO_MATCH_PATH = '/api/photo-match';

const MAX_BYTES = 6_000_000;
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export class MissingMatchKey extends Error {
  constructor() {
    super('Match provider key is not configured');
    this.name = 'MissingMatchKey';
  }
}

export interface PhotoMatchDeps {
  readonly classify: (
    image: Uint8Array,
    mediaType: string,
    idempotencyKey: string,
    signal: AbortSignal,
  ) => Promise<ClassifyResult>;
  readonly now?: () => number;
  readonly rateBuckets?: Map<string, number[]>;
  readonly cache?: Map<string, string>;
}

export async function handlePhotoMatch(request: Request, deps: PhotoMatchDeps): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Tidak ada.', code: 'method' }, 405);
  const now = deps.now ?? Date.now;
  const buckets = deps.rateBuckets ?? new Map<string, number[]>();
  if (!allow(clientKey(request), buckets, now())) {
    return json({ error: 'Terlalu banyak foto. Coba lagi nanti ya.', code: 'rate' }, 429);
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  const cache = deps.cache ?? new Map<string, string>();
  if (idempotencyKey && cache.has(idempotencyKey)) {
    return json(JSON.parse(cache.get(idempotencyKey) ?? '{}') as unknown, 200);
  }

  const mediaType = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_TYPES.has(mediaType)) {
    return json({ error: 'Pilih foto JPG atau PNG ya.', code: 'type' }, 415);
  }
  const claimed = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(claimed) && claimed > MAX_BYTES) {
    return json({ error: 'Fotonya terlalu besar. Coba foto yang lebih kecil.', code: 'size' }, 413);
  }

  const image = new Uint8Array(await request.arrayBuffer());
  if (image.byteLength === 0 || image.byteLength > MAX_BYTES) {
    return json({ error: 'Fotonya terlalu besar. Coba foto yang lebih kecil.', code: 'size' }, 413);
  }

  try {
    // Long enough for Prefer: wait and a short poll if the prediction is still running.
    const classified = await deps.classify(image, mediaType, idempotencyKey || crypto.randomUUID(), AbortSignal.timeout(45_000));
    const match = interpretMatch(classified.raw);
    const body = responseBody(match, classified);
    if (idempotencyKey) remember(cache, idempotencyKey, body);
    return json(body, 200);
  } catch (error) {
    if (error instanceof MissingMatchKey) {
      return json({ error: 'Foto belum bisa dipakai sekarang.', code: 'unconfigured' }, 503);
    }
    return json({ error: 'Foto ini belum bisa dipakai. Coba lagi ya.', code: 'upstream' }, 502);
  }
}

function responseBody(match: PhotoMatch, classified: ClassifyResult): Record<string, unknown> {
  return {
    matched: match.matched,
    category: match.category,
    confidence: match.confidence,
    facing: match.facing,
    pose: match.pose,
    colours: match.colours,
    suggestions: match.suggestions,
    message: match.message,
    model: classified.model,
    ...(classified.usage ? { usage: classified.usage } : {}),
  };
}

function allow(key: string, buckets: Map<string, number[]>, now: number): boolean {
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

function remember(cache: Map<string, string>, key: string, body: Record<string, unknown>): void {
  if (cache.size > 100) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, JSON.stringify(body));
}

function clientKey(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'local';
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
