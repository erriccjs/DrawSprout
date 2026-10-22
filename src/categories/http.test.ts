import { describe, expect, it, vi } from 'vitest';
import { handlePhotoMatch, MatchUpstreamError, MissingMatchKey } from './http';
import type { ClassifyResult } from './openai';

const png = Uint8Array.from([137, 80, 78, 71]);

function post(body: Uint8Array = png, headers: Record<string, string> = {}): Request {
  return new Request('https://drawsprout.example/api/photo-match', {
    method: 'POST',
    headers: { 'content-type': 'image/png', ...headers },
    body: body as unknown as BodyInit,
  });
}

function classify(raw: unknown): ClassifyResult {
  return { raw, usage: { inputTokens: 1000, outputTokens: 40, totalTokens: 1040 }, model: 'gpt-4.1-mini' };
}

describe('photo-match endpoint', () => {
  it('returns the category decision and does not echo the photo', async () => {
    const seen: Uint8Array[] = [];
    const response = await handlePhotoMatch(post(), {
      classify: (image) => {
        seen.push(image);
        return Promise.resolve(classify({
          category: 'cat',
          confidence: 0.88,
          facing: 'front',
          pose: 'sitting',
          colours: [{ part: 'fur', color: '#c47a2a' }],
        }));
      },
    });
    const payload = await response.json() as { matched: boolean; category: string; colours: { color: string }[] };
    expect(response.status).toBe(200);
    expect(payload.matched).toBe(true);
    expect(payload.category).toBe('cat');
    expect(payload.colours[0]?.color).toBe('#c47a2a');
    expect(JSON.stringify(payload)).not.toContain('iVBORw0KGgo');
    expect(seen[0]?.byteLength).toBe(png.byteLength);
  });

  it('returns the friendly list when the category is not drawn yet', async () => {
    const response = await handlePhotoMatch(post(), {
      classify: () => Promise.resolve(classify({
        category: 'dinosaur',
        confidence: 0.95,
        facing: 'right',
        pose: '',
        colours: [],
      })),
    });
    const payload = await response.json() as { matched: boolean; message: string; suggestions: { category: string }[] };
    expect(payload.matched).toBe(false);
    expect(payload.message).toMatch(/Belum bisa digambar/);
    expect(payload.suggestions.map((item) => item.category)).toContain('cat');
    expect(payload.suggestions.map((item) => item.category)).not.toContain('dinosaur');
  });

  it('caches an idempotency key and rate-limits the sixth extra call', async () => {
    const calls = vi.fn(() => Promise.resolve(classify({
      category: 'cup',
      confidence: 0.7,
      facing: 'right',
      pose: '',
      colours: [],
    })));
    const cache = new Map<string, string>();
    const first = await handlePhotoMatch(post(png, { 'idempotency-key': 'same' }), { classify: calls, cache });
    const second = await handlePhotoMatch(post(png, { 'idempotency-key': 'same' }), { classify: calls, cache });
    expect(calls).toHaveBeenCalledTimes(1);
    expect(await second.json()).toEqual(await first.json());

    const buckets = new Map<string, number[]>();
    const now = () => 1_000;
    for (let count = 0; count < 6; count += 1) {
      const allowed = await handlePhotoMatch(post(), { classify: calls, rateBuckets: buckets, now });
      expect(allowed.status).toBe(200);
    }
    const blocked = await handlePhotoMatch(post(), { classify: calls, rateBuckets: buckets, now });
    expect(blocked.status).toBe(429);
  });

  it('reports a missing key without calling the model', async () => {
    const response = await handlePhotoMatch(post(), {
      classify: () => Promise.reject(new MissingMatchKey()),
    });
    expect(response.status).toBe(503);
  });

  it('logs the sanitized upstream status and message', async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const secret = `Bearer ${'A'.repeat(50)}`;
    const response = await handlePhotoMatch(post(), {
      classify: () => Promise.reject(new MatchUpstreamError(
        `refused data:image/jpeg;base64,${'B'.repeat(50)} ${secret}`,
        422,
      )),
    });
    expect(response.status).toBe(502);
    const line = JSON.parse(logs[0] ?? '{}') as { route: string; upstreamStatus: number; upstream: string };
    expect(line).toMatchObject({ route: 'photo-match', upstreamStatus: 422 });
    expect(line.upstream).toContain('[image]');
    expect(line.upstream).toContain('Bearer [redacted]');
    expect(line.upstream).not.toContain('B'.repeat(40));
    expect(logs.join('\n')).not.toContain('A'.repeat(40));
    spy.mockRestore();
  });
});
