/**
 * POST /api/photo-match.
 *
 * The body is the photo and is not written to the response or to logs.
 * A missing category or a low confidence returns the friendly list.
 */

import { PHOTO_MATCH_PATH } from '../photo/paths';
import { scopedCacheKey } from '../worker/shared/cache-key';
import { clientKey, json, sameOrigin } from '../worker/shared/http';
import { rateGateFrom, type RateGate } from '../worker/shared/limit';
import { interpretMatch, type PhotoMatch } from './match';
import type { ClassifyResult } from './openai';

export { PHOTO_MATCH_PATH };

const MAX_BYTES = 6_000_000;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export class MissingMatchKey extends Error {
  constructor() {
    super('Match provider key is not configured');
    this.name = 'MissingMatchKey';
  }
}

/** A Replicate response or fetch failure. `status` is the HTTP status, or 0 when fetch threw. */
export class MatchUpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MatchUpstreamError';
    this.status = status;
  }
}

/** Strip photo bytes and credentials before a message is logged. */
export function redactUpstream(value: string): string {
  return value
    .replace(/data:[^\s'"]+/gi, '[image]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9+/]{40,}/g, '[redacted]')
    .slice(0, 180);
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
  /** Production passes the Durable Object gate. Tests pass `rateBuckets` instead. */
  readonly rateGate?: RateGate;
  readonly cache?: Map<string, string>;
}

export async function handlePhotoMatch(request: Request, deps: PhotoMatchDeps): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Tidak ada.', code: 'method' }, 405);
  if (!sameOrigin(request)) return json({ error: 'Foto tidak dapat dipakai. Pilih gambar lain.', code: 'bad_request' }, 403);
  const now = deps.now ?? Date.now;
  const gate = rateGateFrom(deps);
  if (!await gate.allow(clientKey(request), now())) {
    return json({ error: 'Terlalu banyak foto. Coba lagi nanti ya.', code: 'rate' }, 429);
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  const cache = deps.cache ?? new Map<string, string>();

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

  const cacheKey = idempotencyKey
    ? await scopedCacheKey(clientKey(request), idempotencyKey, image, mediaType)
    : '';
  if (cacheKey && cache.has(cacheKey)) {
    return json(JSON.parse(cache.get(cacheKey) ?? '{}') as unknown, 200);
  }

  try {
    // Long enough for Prefer: wait and a short poll if the prediction is still running.
    const classified = await deps.classify(image, mediaType, idempotencyKey || crypto.randomUUID(), AbortSignal.timeout(45_000));
    const match = interpretMatch(classified.raw);
    const body = responseBody(match, classified);
    if (cacheKey) remember(cache, cacheKey, body);
    return json(body, 200);
  } catch (error) {
    if (error instanceof MissingMatchKey) {
      return json({ error: 'Foto belum bisa dipakai sekarang.', code: 'unconfigured' }, 503);
    }
    const upstreamStatus = error instanceof MatchUpstreamError ? error.status : 0;
    const upstream = redactUpstream(error instanceof Error ? error.message : 'Replicate match failed');
    console.log(JSON.stringify({ route: 'photo-match', upstreamStatus, upstream }));
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

function remember(cache: Map<string, string>, key: string, body: Record<string, unknown>): void {
  if (cache.size > 100) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, JSON.stringify(body));
}

