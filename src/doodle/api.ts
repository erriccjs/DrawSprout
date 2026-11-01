/**
 * POST /api/doodle.
 *
 * The body is a JPEG the phone already resized. It is not logged and not
 * written to storage. The response is the line drawing only.
 */

import { scopedCacheKey } from '../worker/shared/cache-key';
import { clientKey, json, sameOrigin } from '../worker/shared/http';
import { rateGateFrom, type RateGate } from '../worker/shared/limit';
import { jpegSize } from './jpeg';
import { doodleModelFor, doodleWithReplicate, DoodleUpstreamError } from './replicate';

export const DOODLE_API_PATH = '/api/doodle';

const MAX_BYTES = 1_500_000;
const MAX_EDGE = 1024;

const messages = {
  missing_key: 'Doodle belum bisa dibuat di server ini.',
  bad_request: 'Foto tidak dapat dipakai. Pilih gambar lain.',
  type: 'Pilih foto JPG atau PNG ya.',
  too_large: 'Fotonya terlalu besar. Coba foto yang lebih kecil.',
  rate_limited: 'Terlalu banyak permintaan. Coba lagi nanti.',
  unavailable: 'Server doodle belum siap. Coba lagi nanti.',
  busy: 'Server gambar sedang sibuk. Coba lagi nanti.',
  failed: 'Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.',
} as const;

export interface DoodleApiDeps {
  readonly apiKey?: string;
  readonly model?: string;
  readonly now?: () => number;
  readonly rateGate?: RateGate;
  readonly rateBuckets?: Map<string, number[]>;
  readonly cache?: Map<string, string>;
  readonly draw?: typeof doodleWithReplicate;
}

export async function handleDoodleRequest(request: Request, deps: DoodleApiDeps): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Tidak ada.', code: 'method' }, 405);
  if (!sameOrigin(request)) return json({ error: messages.bad_request, code: 'bad_request' }, 403);
  const mediaType = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (mediaType !== 'image/jpeg') return json({ error: messages.type, code: 'type' }, 415);
  const claimed = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(claimed) && claimed > MAX_BYTES) return json({ error: messages.too_large, code: 'size' }, 413);

  const jpeg = new Uint8Array(await request.arrayBuffer());
  if (jpeg.byteLength === 0 || jpeg.byteLength > MAX_BYTES) {
    return json({ error: messages.too_large, code: 'size' }, 413);
  }
  const size = jpegSize(jpeg);
  if (!size || Math.max(size.width, size.height) > MAX_EDGE) {
    return json({ error: size ? messages.too_large : messages.bad_request, code: size ? 'size' : 'bad_request' }, size ? 413 : 400);
  }

  const cache = deps.cache ?? new Map<string, string>();
  // The model is part of the key: switching it must not serve a drawing the
  // previous one made.
  const cacheKey = await scopedCacheKey(
    clientKey(request),
    'doodle',
    jpeg,
    `image/jpeg\n${doodleModelFor(deps.model)}`,
  );
  const cached = cache.get(cacheKey);
  if (cached) return json(JSON.parse(cached) as unknown, 200);

  const gate = rateGateFrom(deps);
  const verdict = await gate.allow(clientKey(request), (deps.now ?? Date.now)());
  if (!verdict.allowed) {
    if (verdict.reason === 'unavailable') {
      return json({ error: messages.unavailable, code: 'unavailable' }, 503);
    }
    return json({ error: messages.rate_limited, code: 'rate' }, 429);
  }
  if (!deps.apiKey) return json({ error: messages.missing_key, code: 'missing_key' }, 500);

  try {
    const png = await (deps.draw ?? doodleWithReplicate)({
      apiKey: deps.apiKey,
      jpeg,
      ...(deps.model ? { model: deps.model } : {}),
      signal: AbortSignal.timeout(50_000),
    });
    const body = { png: bytesToBase64(png) };
    remember(cache, cacheKey, JSON.stringify(body));
    return json(body, 200);
  } catch (error) {
    if (error instanceof DoodleUpstreamError && error.status === 429) {
      return json({ error: messages.busy, code: 'busy' }, 503);
    }
    return json({ error: messages.failed, code: 'failed' }, 502);
  }
}

function remember(cache: Map<string, string>, key: string, body: string): void {
  if (cache.size > 24) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, body);
}

function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
