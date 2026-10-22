/**
 * POST /api/photo-lesson.
 *
 * Validates the upload, rate-limits new jobs, and dedupes a retry by
 * idempotency key before any second call to OpenAI. Photo bytes are not
 * written to logs. The in-memory success cache is per isolate only; the
 * OpenAI Idempotency-Key header is what prevents a duplicate billed job
 * after the isolate goes away.
 */

import { bytesToBase64 } from './openai';
import type { ImageEditor, InstructionWriter } from './openai';
import { runPhotoPipeline } from './pipeline';
import { imageProvider, replicateApiKey } from './provider';
import { DEFAULT_TEXT_MODEL, type PhotoVariant } from './prompts';
import { decodePng } from './png';

export const PHOTO_API_PATH = '/api/photo-lesson';

export interface PhotoEnv {
  readonly OPENAI_API_KEY?: string;
  readonly OPENAI_IMAGE_MODEL?: string;
  readonly OPENAI_TEXT_MODEL?: string;
  readonly IMAGE_PROVIDER?: string;
  readonly REPLICATE_API_KEY?: string;
  readonly REPLICATE_API_TOKEN?: string;
  readonly REPLICATE_IMAGE_MODEL?: string;
}

export interface JobCache {
  readonly success: Map<string, string>;
  readonly inflight: Map<string, Promise<string>>;
}

export interface PhotoApiDeps {
  readonly images: ImageEditor;
  readonly instructions?: InstructionWriter;
  readonly now?: () => number;
  readonly cache?: JobCache;
  readonly rateBuckets?: Map<string, number[]>;
  readonly newLessonId?: () => string;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 2048;
const MAX_PIXELS = 2048 * 2048;
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const PNG = [137, 80, 78, 71, 13, 10, 26, 10];

const parentMessages = {
  missing_key: 'Layanan foto belum dipasang di server (OPENAI_API_KEY atau REPLICATE_API_KEY).',
  bad_request: 'Foto tidak dapat dipakai. Pilih gambar lain.',
  too_large: 'Foto terlalu besar. Pilih bagian yang lebih kecil.',
  rate_limited: 'Terlalu banyak permintaan. Coba lagi nanti.',
  cancelled: 'Permintaan dibatalkan.',
  timeout: 'Waktunya habis. Coba lagi.',
  failed: 'Gambar belum bisa dibuat. Coba lagi, atau pilih foto lain.',
} as const;

class PhotoRequestError extends Error {
  readonly code: keyof typeof parentMessages;
  readonly status: number;

  constructor(code: keyof typeof parentMessages, status: number) {
    super(parentMessages[code]);
    this.name = 'PhotoRequestError';
    this.code = code;
    this.status = status;
  }
}

export async function handlePhotoLessonRequest(
  request: Request,
  env: PhotoEnv,
  deps: PhotoApiDeps,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Tidak ada.', code: 'method' }, 405);
  if (!sameOrigin(request)) return fail('bad_request', 403);
  const cache: JobCache = deps.cache ?? { success: new Map<string, string>(), inflight: new Map<string, Promise<string>>() };
  const buckets: Map<string, number[]> = deps.rateBuckets ?? new Map<string, number[]>();
  const now = deps.now ?? Date.now;

  let form: FormData;
  try {
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_BYTES + 64_000) return fail('too_large', 413);
    form = await request.formData();
  } catch {
    return fail('bad_request', 400);
  }

  const idempotencyKey = stringField(form.get('idempotencyKey'));
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) return fail('bad_request', 400);
  const variant = parseVariant(stringField(form.get('variant')));
  if (!variant) return fail('bad_request', 400);

  const cached = cache.success.get(idempotencyKey);
  if (cached) return new Response(cached, { status: 200, headers: jsonHeaders() });
  const pending = cache.inflight.get(idempotencyKey);
  if (pending) {
    try {
      return new Response(await pending, { status: 200, headers: jsonHeaders() });
    } catch (error) {
      return failureResponse(error);
    }
  }

  let resolveWork: (body: string) => void = () => undefined;
  let rejectWork: (error: unknown) => void = () => undefined;
  const work = new Promise<string>((resolve, reject) => {
    resolveWork = resolve;
    rejectWork = reject;
  });
  // A retry can lose the race and find no waiter. Swallow that rejection here;
  // the leader still returns the parent-facing response.
  work.catch(() => undefined);
  cache.inflight.set(idempotencyKey, work);

  try {
    if (!hasImageSecret(env)) throw new PhotoRequestError('missing_key', 500);
    const file = asBlob(form.get('image'));
    if (!file) throw new PhotoRequestError('bad_request', 400);
    const fileType = 'type' in file && typeof file.type === 'string' ? file.type : '';
    if (fileType !== '' && fileType !== 'image/png' && fileType !== 'application/octet-stream') {
      throw new PhotoRequestError('bad_request', 400);
    }
    if (file.size > MAX_BYTES) throw new PhotoRequestError('too_large', 413);
    const png = new Uint8Array(await file.arrayBuffer());
    if (!isPng(png)) throw new PhotoRequestError('bad_request', 400);
    try {
      const image = await decodePng(png);
      if (Math.max(image.width, image.height) > MAX_EDGE || image.width * image.height > MAX_PIXELS) {
        throw new PhotoRequestError('too_large', 413);
      }
    } catch (error) {
      if (error instanceof PhotoRequestError) throw error;
      throw new PhotoRequestError('bad_request', 400);
    }
    if (!allow(buckets, clientKey(request), now())) throw new PhotoRequestError('rate_limited', 429);

    const provider = imageProvider(env.IMAGE_PROVIDER);
    const configuredImageModel = provider === 'replicate' ? env.REPLICATE_IMAGE_MODEL : env.OPENAI_IMAGE_MODEL;
    const result = await runPhotoPipeline({
      png,
      variant,
      idempotencyKey,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(420_000)]),
      provider,
      ...(configuredImageModel ? { configuredImageModel } : {}),
      textModel: env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
      lessonId: deps.newLessonId?.() ?? `photo-${crypto.randomUUID()}`,
    }, {
      images: deps.images,
      ...(deps.instructions ? { instructions: deps.instructions } : {}),
    });
    const body = JSON.stringify({
      illustrationPng: bytesToBase64(result.illustrationPng),
      dominantColors: result.dominantColors,
      lesson: result.lesson,
      targetHash: result.targetHash,
      needsReview: result.needsReview,
      reviewReason: result.reviewReason,
      model: result.model,
      imageUsage: result.imageUsage,
      textUsage: result.textUsage,
    });
    cache.success.set(idempotencyKey, body);
    if (cache.success.size > 32) {
      const oldest = cache.success.keys().next().value;
      if (oldest) cache.success.delete(oldest);
    }
    resolveWork(body);
    return new Response(body, { status: 200, headers: jsonHeaders() });
  } catch (error) {
    rejectWork(error);
    return failureResponse(error);
  } finally {
    cache.inflight.delete(idempotencyKey);
  }
}

function hasImageSecret(env: PhotoEnv): boolean {
  if (imageProvider(env.IMAGE_PROVIDER) === 'replicate') return replicateApiKey(env) !== undefined;
  return Boolean(env.OPENAI_API_KEY);
}

function allow(buckets: Map<string, number[]>, key: string, nowMs: number): boolean {
  const recent = (buckets.get(key) ?? []).filter((time) => nowMs - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  buckets.set(key, recent);
  return true;
}

function clientKey(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? 'local';
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function parseVariant(value: string): PhotoVariant | null {
  if (value === '' || value === 'default' || value === 'faithful' || value === 'simple') {
    return value === '' ? 'default' : value;
  }
  return null;
}

function stringField(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

function asBlob(value: FormDataEntryValue | null): Blob | null {
  if (value === null || typeof value === 'string') return null;
  if (typeof value.arrayBuffer !== 'function' || typeof value.size !== 'number') return null;
  return value;
}

function isPng(bytes: Uint8Array): boolean {
  return PNG.every((byte, index) => bytes[index] === byte);
}

function failureResponse(error: unknown): Response {
  if (error instanceof PhotoRequestError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof Error && error.name === 'AbortError') return fail('cancelled', 499);
  if (error instanceof Error && error.name === 'TimeoutError') return fail('timeout', 504);
  return fail('failed', 502);
}

function fail(code: keyof typeof parentMessages, status: number): Response {
  return json({ error: parentMessages[code], code }, status);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders() });
}

function jsonHeaders(): Headers {
  return new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
}
