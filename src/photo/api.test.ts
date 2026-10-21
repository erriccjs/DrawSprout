import { beforeAll, describe, expect, it } from 'vitest';
import { handlePhotoLessonRequest, type JobCache, type PhotoApiDeps } from './api';
import type { ImageEditor } from './openai';
import { encodePng, type RgbaImage } from './png';

function frame(): RgbaImage {
  const width = 48;
  const height = 36;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = x >= 6 && x < 42 && y >= 6 && y < 30;
      const index = (y * width + x) * 4;
      data[index] = on ? 0 : 255;
      data[index + 1] = on ? 0 : 255;
      data[index + 2] = on ? 0 : 255;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

function fileFrom(bytes: Uint8Array, type = 'image/png'): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], 'photo.png', { type });
}

function post(bytes: Uint8Array, key: string, variant = '', type?: string): Request {
  const form = new FormData();
  form.set('image', type === undefined ? fileFrom(bytes) : fileFrom(bytes, type));
  form.set('idempotencyKey', key);
  if (variant) form.set('variant', variant);
  return new Request('https://drawsprout.test/api/photo-lesson', { method: 'POST', body: form });
}

describe('POST /api/photo-lesson', () => {
  let art = new Uint8Array();

  beforeAll(async () => {
    const encoded = await encodePng(frame());
    art = new Uint8Array(encoded.byteLength);
    art.set(encoded);
  });

  function editor(png = art, delayMs = 0): { images: ImageEditor; calls: { model: string; key: string; quality: string }[] } {
    const calls: { model: string; key: string; quality: string }[] = [];
    return {
      calls,
      images: {
        async edit(input) {
          calls.push({ model: input.model, key: input.idempotencyKey, quality: input.quality });
          if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
          return { png, usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 } };
        },
      },
    };
  }

  function deps(images: ImageEditor, extra: Partial<PhotoApiDeps> = {}): PhotoApiDeps & { cache: JobCache; rateBuckets: Map<string, number[]> } {
    return {
      images,
      cache: extra.cache ?? { success: new Map<string, string>(), inflight: new Map<string, Promise<string>>() },
      rateBuckets: extra.rateBuckets ?? new Map<string, number[]>(),
      now: extra.now ?? (() => 1_000),
      newLessonId: extra.newLessonId ?? (() => 'photo-test'),
      ...(extra.instructions ? { instructions: extra.instructions } : {}),
    };
  }

  it('rejects a non-png and does not call OpenAI', async () => {
    const mock = editor();
    const response = await handlePhotoLessonRequest(
      post(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]), 'bad-magic-key'),
      { OPENAI_API_KEY: 'test-key' },
      deps(mock.images),
    );
    expect(response.status).toBe(400);
    expect(mock.calls).toHaveLength(0);
  });

  it('refuses the job when the key is missing and does not spend a rate slot', async () => {
    const mock = editor();
    const buckets = new Map<string, number[]>();
    const response = await handlePhotoLessonRequest(post(art, 'missing-key-1'), {}, deps(mock.images, { rateBuckets: buckets }));
    expect(response.status).toBe(500);
    const body = await response.json() as { code: string; error: string };
    expect(body.code).toBe('missing_key');
    expect(body.error).toContain('OPENAI_API_KEY');
    expect(mock.calls).toHaveLength(0);
    expect(buckets.size).toBe(0);
  });

  it('runs one edit for two retries of the same key', async () => {
    const mock = editor(art, 40);
    const shared = deps(mock.images);
    const [first, second] = await Promise.all([
      handlePhotoLessonRequest(post(art, 'same-key-01'), { OPENAI_API_KEY: 'test-key' }, shared),
      handlePhotoLessonRequest(post(art, 'same-key-01'), { OPENAI_API_KEY: 'test-key' }, shared),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0]?.key).toBe('same-key-01');
    expect(mock.calls[1]?.key).toBe('same-key-01-colour');
    const body = await first.json() as { lesson: { steps: { instruction: string }[] }; targetHash: string };
    expect(body.targetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.lesson.steps[0]?.instruction).toMatch(/Gambar bentuk yang paling besar|Gambar garis luar|bentuk dasar/);

    const third = await handlePhotoLessonRequest(post(art, 'same-key-01'), { OPENAI_API_KEY: 'test-key' }, shared);
    expect(third.status).toBe(200);
    expect(mock.calls).toHaveLength(2);
  });

  it('calls OpenAI again for a different key and for a failed retry', async () => {
    let fail = true;
    const calls: string[] = [];
    const images: ImageEditor = {
      edit(input) {
        calls.push(input.idempotencyKey);
        if (fail) {
          fail = false;
          return Promise.reject(new Error('upstream'));
        }
        return Promise.resolve({ png: art, usage: null });
      },
    };
    const shared = deps(images);
    const failed = await handlePhotoLessonRequest(post(art, 'retry-after-fail'), { OPENAI_API_KEY: 'test-key' }, shared);
    expect(failed.status).toBe(502);
    const again = await handlePhotoLessonRequest(post(art, 'retry-after-fail'), { OPENAI_API_KEY: 'test-key' }, shared);
    expect(again.status).toBe(200);
    const other = await handlePhotoLessonRequest(post(art, 'other-key-02'), { OPENAI_API_KEY: 'test-key' }, shared);
    expect(other.status).toBe(200);
    expect(calls).toEqual(['retry-after-fail', 'retry-after-fail', 'retry-after-fail-colour', 'other-key-02', 'other-key-02-colour']);
  });

  it('uses gpt-image-1.5 at low quality for simple, and the configured model otherwise', async () => {
    const mock = editor();
    const simple = await handlePhotoLessonRequest(
      post(art, 'simple-key1', 'simple'),
      { OPENAI_API_KEY: 'test-key', OPENAI_IMAGE_MODEL: 'gpt-image-2' },
      deps(mock.images),
    );
    expect(simple.status).toBe(200);
    expect(mock.calls[0]?.model).toBe('gpt-image-1.5');
    expect(mock.calls[0]?.quality).toBe('low');
    expect(mock.calls[1]?.quality).toBe('low');

    const unknown = await handlePhotoLessonRequest(
      post(art, 'default-key1', 'default'),
      { OPENAI_API_KEY: 'test-key', OPENAI_IMAGE_MODEL: 'not-a-model' },
      deps(mock.images),
    );
    expect(unknown.status).toBe(200);
    expect(mock.calls[2]?.model).toBe('gpt-image-1.5');
    expect(mock.calls[2]?.quality).toBe('medium');
    expect(mock.calls[3]?.quality).toBe('low');

    const cheap = await handlePhotoLessonRequest(
      post(art, 'cheap-key001', 'default'),
      { OPENAI_API_KEY: 'test-key', OPENAI_IMAGE_MODEL: 'gpt-image-1-mini' },
      deps(mock.images),
    );
    expect(cheap.status).toBe(200);
    expect(mock.calls[4]?.model).toBe('gpt-image-1-mini');
    expect(mock.calls[4]?.quality).toBe('medium');
  });

  it('rate-limits new jobs and still serves a cached retry', async () => {
    const mock = editor();
    let time = 5_000;
    const shared = deps(mock.images, { now: () => time });
    for (let index = 0; index < 6; index += 1) {
      const response = await handlePhotoLessonRequest(
        post(art, `rate-key-${index}`),
        { OPENAI_API_KEY: 'test-key' },
        shared,
      );
      expect(response.status).toBe(200);
    }
    const blocked = await handlePhotoLessonRequest(post(art, 'rate-key-extra'), { OPENAI_API_KEY: 'test-key' }, shared);
    expect(blocked.status).toBe(429);
    const cached = await handlePhotoLessonRequest(post(art, 'rate-key-0'), { OPENAI_API_KEY: 'test-key' }, shared);
    expect(cached.status).toBe(200);
    expect(mock.calls).toHaveLength(12);

    time += 11 * 60 * 1000;
    const later = await handlePhotoLessonRequest(post(art, 'rate-key-later'), { OPENAI_API_KEY: 'test-key' }, shared);
    expect(later.status).toBe(200);
  });

  it('rejects an image whose long edge is over 2048', async () => {
    const wide = new Uint8Array(2049 * 2 * 4);
    wide.fill(255);
    const png = await encodePng({ width: 2049, height: 2, data: wide });
    const mock = editor();
    const response = await handlePhotoLessonRequest(post(png, 'too-wide-key'), { OPENAI_API_KEY: 'test-key' }, deps(mock.images));
    expect(response.status).toBe(413);
    expect(mock.calls).toHaveLength(0);
  });

  it('accepts REPLICATE_API_KEY, and the token name only when the key is absent', async () => {
    const mock = editor();
    const missing = await handlePhotoLessonRequest(
      post(art, 'replicate-missing'),
      { IMAGE_PROVIDER: 'replicate' },
      deps(mock.images),
    );
    expect(missing.status).toBe(500);
    const body = await missing.json() as { error: string };
    expect(body.error).toContain('REPLICATE_API_KEY');
    expect(mock.calls).toHaveLength(0);

    const tokenOnly = await handlePhotoLessonRequest(
      post(art, 'replicate-token'),
      { IMAGE_PROVIDER: 'replicate', REPLICATE_API_TOKEN: 'r8-legacy' },
      deps(mock.images),
    );
    expect(tokenOnly.status).toBe(200);

    const keyWins = await handlePhotoLessonRequest(
      post(art, 'replicate-key'),
      { IMAGE_PROVIDER: 'replicate', REPLICATE_API_KEY: 'r8-canonical', REPLICATE_API_TOKEN: 'r8-legacy' },
      deps(mock.images),
    );
    expect(keyWins.status).toBe(200);
  });
});
