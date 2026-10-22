import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handlePhotoMatch } from './http';
import { matchProvider, replicateMatchModel } from './provider';
import { classifyWithReplicate, parseModelJson, replicateMatchInput } from './replicate';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const secret = 'r8_test_key_that_must_not_appear_in_errors_or_logs_0123456789';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('replicate photo match', () => {
  it('sends the photo as image_input and reads a joined prediction', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const answer = {
      category: 'cat',
      confidence: 0.91,
      facing: 'front',
      pose: 'sitting',
      colours: [{ part: 'fur', color: '#c47a2a' }],
    };
    const text = JSON.stringify(answer);
    vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      if (calls.length === 1) {
        return Promise.resolve(jsonResponse({ id: 'pred-1', status: 'processing', output: null }));
      }
      return Promise.resolve(jsonResponse({
        id: 'pred-1',
        status: 'succeeded',
        output: [text.slice(0, 12), text.slice(12)],
        metrics: { input_token_count: 1800, output_token_count: 42 },
      }));
    });

    const result = await classifyWithReplicate({
      apiKey: secret,
      image: png,
      mediaType: 'image/png',
      idempotencyKey: 'match-1',
      signal: AbortSignal.timeout(10_000),
    });

    expect(result.raw).toEqual(answer);
    expect(result.model).toBe('openai/gpt-4.1-mini');
    expect(result.usage).toEqual({ inputTokens: 1800, outputTokens: 42, totalTokens: 1842 });
    expect(calls[0]?.url).toBe('https://api.replicate.com/v1/models/openai/gpt-4.1-mini/predictions');
    expect(calls[1]?.url).toBe('https://api.replicate.com/v1/predictions/pred-1');
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get('prefer')).toBe('wait=20');
    expect(headers.get('authorization')).toBe(`Bearer ${secret}`);
    expect(headers.get('idempotency-key')).toBe('match-1');
    const rawBody = calls[0]?.init.body;
    const body = JSON.parse(typeof rawBody === 'string' ? rawBody : '') as { input: Record<string, unknown> };
    expect(body.input.image_input).toEqual([expect.stringMatching(/^data:image\/png;base64,/)]);
    expect(body.input).not.toHaveProperty('messages');
    expect(body.input.temperature).toBe(0);
    expect(body.input.max_completion_tokens).toBe(400);
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it('keeps the 0.55 fallback and does not echo the photo', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse({
      id: 'pred-low',
      status: 'succeeded',
      output: '{"category":"cat","confidence":0.2,"facing":"left","pose":"","colours":[]}',
    })));
    const response = await handlePhotoMatch(new Request('https://drawsprout.example/api/photo-match', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: png as unknown as BodyInit,
    }), {
      classify: (image, mediaType, idempotencyKey, signal) => classifyWithReplicate({
        apiKey: secret,
        image,
        mediaType,
        idempotencyKey,
        signal,
      }),
    });
    const payload = await response.json() as { matched: boolean; message: string; suggestions: { category: string }[] };
    expect(payload.matched).toBe(false);
    expect(payload.message).toMatch(/Belum bisa digambar/);
    expect(payload.suggestions.map((item) => item.category)).toContain('apple');
    expect(JSON.stringify(payload)).not.toContain('data:image');
  });

  it('cancels a prediction that is still running when the request is aborted', async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    vi.stubGlobal('fetch', (url: string) => {
      calls.push(String(url));
      controller.abort();
      return Promise.resolve(jsonResponse({ id: 'pred-slow', status: 'processing' }));
    });
    await expect(classifyWithReplicate({
      apiKey: secret,
      image: png,
      mediaType: 'image/png',
      idempotencyKey: 'match-abort',
      signal: controller.signal,
    })).rejects.toThrow(/timed out/);
    expect(calls.some((url) => url.endsWith('/pred-slow/cancel'))).toBe(true);
  });

  it('drops photo bytes and the key from an upstream error', async () => {
    const dumped = `refused data:image/png;base64,${'A'.repeat(80)} Bearer ${secret}`;
    vi.stubGlobal('fetch', () => Promise.resolve(jsonResponse({ detail: dumped }, 400)));
    await expect(classifyWithReplicate({
      apiKey: secret,
      image: png,
      mediaType: 'image/png',
      idempotencyKey: 'match-bad',
      signal: AbortSignal.timeout(5_000),
    })).rejects.toThrow(/\[image\]/);
    try {
      await classifyWithReplicate({
        apiKey: secret,
        image: png,
        mediaType: 'image/png',
        idempotencyKey: 'match-bad-2',
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      expect(message).not.toContain(secret);
      expect(message).not.toContain('data:image');
      expect(message).not.toContain('A'.repeat(40));
    }
  });

  it('uses the configured model and defaults otherwise', () => {
    expect(matchProvider(undefined)).toBe('replicate');
    expect(matchProvider('')).toBe('replicate');
    expect(matchProvider('openai')).toBe('openai');
    expect(matchProvider('other')).toBe('replicate');
    expect(replicateMatchModel(undefined)).toBe('openai/gpt-4.1-mini');
    expect(replicateMatchModel('owner/custom-model')).toBe('owner/custom-model');
    expect(replicateMatchModel('../nope')).toBe('openai/gpt-4.1-mini');
    const input = replicateMatchInput('image/jpeg', 'aaaa');
    expect(input.image_input).toEqual(['data:image/jpeg;base64,aaaa']);
    expect(parseModelJson('```json\n{"category":"dog"}\n```')).toEqual({ category: 'dog' });
    const source = readFileSync(path.join(process.cwd(), 'src/categories/replicate.ts'), 'utf8');
    expect(source).not.toMatch(/console\.(log|info|debug|warn|error)/);
  });
});
