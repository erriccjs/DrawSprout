import { describe, expect, it, vi } from 'vitest';
import { handleDoodleRequest } from './api';
import { DoodleUpstreamError } from './replicate';

const jpeg = jpegBytes(64, 48);

describe('POST /api/doodle', () => {
  it('rejects a foreign page, a PNG, an oversized photo, and a sixth paid call', async () => {
    const foreign = await handleDoodleRequest(post(jpeg, { origin: 'https://evil.example' }), { apiKey: 'key' });
    expect(foreign.status).toBe(403);

    const png = await handleDoodleRequest(post(jpeg, { type: 'image/png' }), { apiKey: 'key' });
    expect(png.status).toBe(415);

    const huge = await handleDoodleRequest(post(jpegBytes(2000, 2000)), { apiKey: 'key' });
    expect(huge.status).toBe(413);

    const buckets = new Map<string, number[]>();
    for (let count = 0; count < 6; count += 1) {
      const response = await handleDoodleRequest(post(jpeg), {
        apiKey: 'key',
        rateBuckets: buckets,
        draw: () => Promise.resolve(Uint8Array.from([137, 80, 78, 71])),
      });
      expect(response.status).toBe(200);
    }
    const limited = await handleDoodleRequest(post(jpeg), { apiKey: 'key', rateBuckets: buckets });
    expect(limited.status).toBe(429);
  });

  it('returns the doodle and turns a Replicate 429 into a retry message', async () => {
    const draw = vi.fn(() => Promise.resolve(Uint8Array.from([137, 80, 78, 71, 1])));
    const ok = await handleDoodleRequest(post(jpeg), { apiKey: 'secret-key', draw });
    expect(ok.status).toBe(200);
    const body = await ok.json() as { png: string };
    expect(body.png.startsWith('iVBORw')).toBe(true);
    expect(JSON.stringify(body)).not.toContain('secret-key');
    expect(draw).toHaveBeenCalledOnce();

    const cache = new Map<string, string>();
    const again = vi.fn(() => Promise.resolve(Uint8Array.from([137, 80, 78, 71, 1])));
    await handleDoodleRequest(post(jpeg), { apiKey: 'secret-key', draw: again, cache });
    const repeat = await handleDoodleRequest(post(jpeg), { apiKey: 'secret-key', draw: again, cache });
    expect(repeat.status).toBe(200);
    expect(again).toHaveBeenCalledOnce();

    const limited = await handleDoodleRequest(post(jpegBytes(32, 32)), {
      apiKey: 'secret-key',
      draw: () => Promise.reject(new DoodleUpstreamError('rate', 429)),
    });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: 'rate' });
  });
});

function post(bytes: Uint8Array, options?: { origin?: string; type?: string }): Request {
  return new Request('https://drawsprout.test/api/doodle', {
    method: 'POST',
    headers: {
      'content-type': options?.type ?? 'image/jpeg',
      ...(options?.origin ? { origin: options.origin } : {}),
    },
    body: bytes as unknown as BodyInit,
  });
}

function jpegBytes(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}
