import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64 } from './openai';
import { replicateApiKey } from './provider';
import { replicateAspect, replicateEditor, replicateModelFor, replicateUsesImagePrompt } from './replicate';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Replicate editor', () => {
  it('prefers REPLICATE_API_KEY and falls back to the token name', () => {
    expect(replicateApiKey({ REPLICATE_API_KEY: ' key ', REPLICATE_API_TOKEN: 'token' })).toBe('key');
    expect(replicateApiKey({ REPLICATE_API_TOKEN: ' token ' })).toBe('token');
    expect(replicateApiKey({ REPLICATE_API_KEY: 'Bearer r8_live' })).toBe('r8_live');
    expect(replicateApiKey({ REPLICATE_API_KEY: '"r8_quoted"' })).toBe('r8_quoted');
    expect(replicateApiKey({ REPLICATE_API_KEY: "'Bearer r8_both'" })).toBe('r8_both');
    expect(replicateApiKey({})).toBeUndefined();
  });

  it('edits with flux-kontext-pro and does not put the key in the body', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      if (url === 'https://replicate.delivery/pbxt/out.png') return Promise.resolve(new Response(png));
      return Promise.resolve(new Response(JSON.stringify({
        id: 'pred-1',
        status: 'succeeded',
        output: 'https://replicate.delivery/pbxt/out.png',
      }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await replicateEditor('r8-secret').edit({
      png,
      variant: 'default',
      model: 'black-forest-labs/flux-kontext-pro',
      quality: 'medium',
      width: 800,
      height: 600,
      idempotencyKey: 'rep-key-1',
      signal: AbortSignal.timeout(1000),
    });
    expect(result.png[0]).toBe(137);
    expect(result.usage).toBeNull();
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer r8-secret');
    expect(headers.get('idempotency-key')).toBe('rep-key-1');
    expect(headers.get('prefer')).toBe('wait=60');
    expect(requestUrl(fetchMock.mock.calls[0]?.[0])).toBe('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions');
    if (typeof init?.body !== 'string') throw new Error('expected JSON');
    const body = JSON.parse(init.body) as { input: { prompt: string; input_image: string; output_format: string; aspect_ratio: string } };
    expect(body.input.output_format).toBe('png');
    expect(body.input.aspect_ratio).toBe('match_input_image');
    expect(body.input.input_image.startsWith('data:image/png;base64,')).toBe(true);
    expect(body.input.prompt).toContain('white background');
    expect(body.input.prompt).toContain('No colour');
    expect(body.input.prompt).toContain('framing');
    expect(body.input.prompt).toContain('Do not zoom in');
    expect(body.input.prompt).toContain('zoom out');
    expect(body.input.prompt).not.toMatch(/vehicle|wheel|\bcar\b|toy/i);
    expect(init.body).not.toContain('r8-secret');
  });

  it('polls a running prediction and uses image_prompt for flux-1.1-pro', async () => {
    let gets = 0;
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (url.endsWith('/out.png')) return Promise.resolve(new Response(png));
      if (init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ id: 'pred-2', status: 'processing', output: null }), { status: 200 }));
      }
      gets += 1;
      return Promise.resolve(new Response(JSON.stringify({
        id: 'pred-2',
        status: 'succeeded',
        output: 'https://replicate.delivery/pbxt/out.png',
      }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await replicateEditor('r8-secret').edit({
      png,
      variant: 'simple',
      model: 'black-forest-labs/flux-1.1-pro',
      quality: 'low',
      width: 400,
      height: 800,
      idempotencyKey: 'rep-key-2',
      signal: AbortSignal.timeout(5_000),
    });
    expect(gets).toBe(1);
    const created = fetchMock.mock.calls[0]?.[1];
    if (typeof created?.body !== 'string') throw new Error('expected JSON');
    const body = JSON.parse(created.body) as { input: { image_prompt?: string; input_image?: string; aspect_ratio: string } };
    expect(body.input.image_prompt?.startsWith('data:image/png;base64,')).toBe(true);
    expect(body.input.input_image).toBeUndefined();
    expect(body.input.aspect_ratio).toBe('9:16');
    expect(created.body).not.toContain('r8-secret');
  });

  it('cancels a prediction when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (url.endsWith('/cancel')) return Promise.resolve(new Response('{}', { status: 200 }));
      if (init?.method === 'POST') {
        controller.abort();
        return Promise.resolve(new Response(JSON.stringify({ id: 'pred-4', status: 'processing' }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(replicateEditor('r8-secret').edit({
      png,
      variant: 'default',
      model: 'black-forest-labs/flux-kontext-pro',
      quality: 'medium',
      width: 100,
      height: 100,
      idempotencyKey: 'rep-key-4',
      signal: controller.signal,
    })).rejects.toThrow(/cancelled/);
    expect(fetchMock.mock.calls.some((call) => requestUrl(call[0]).endsWith('/predictions/pred-4/cancel'))).toBe(true);
  });

  it('retries a 429 before accepting the prediction', async () => {
    let posts = 0;
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      const url = requestUrl(input);
      if (url.endsWith('/out.png')) return Promise.resolve(new Response(png));
      if (init?.method === 'POST') {
        posts += 1;
        if (posts === 1) {
          return Promise.resolve(new Response(JSON.stringify({ detail: 'throttled' }), {
            status: 429,
            headers: { 'retry-after': '0.05' },
          }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          id: 'pred-5',
          status: 'succeeded',
          output: 'https://replicate.delivery/pbxt/out.png',
        }), { status: 200 }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await replicateEditor('r8-secret').edit({
      png,
      variant: 'default',
      model: 'black-forest-labs/flux-kontext-pro',
      quality: 'medium',
      width: 100,
      height: 100,
      idempotencyKey: 'rep-key-5',
      signal: AbortSignal.timeout(5_000),
    });
    expect(result.png[0]).toBe(137);
    expect(posts).toBe(2);
  });

  it('refuses an output URL that is not replicate.delivery', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      id: 'pred-3',
      status: 'succeeded',
      output: 'https://example.test/secret.png',
    }), { status: 200 }))));
    await expect(replicateEditor('r8-secret').edit({
      png,
      variant: 'default',
      model: 'black-forest-labs/flux-kontext-pro',
      quality: 'medium',
      width: 100,
      height: 100,
      idempotencyKey: 'rep-key-3',
      signal: AbortSignal.timeout(1000),
    })).rejects.toThrow(/not accepted/);
  });

  it('knows the default model and the guidance-only model', () => {
    expect(replicateModelFor(undefined)).toBe('black-forest-labs/flux-kontext-pro');
    expect(replicateModelFor('not a model')).toBe('black-forest-labs/flux-kontext-pro');
    expect(replicateModelFor('owner/custom-model')).toBe('owner/custom-model');
    expect(replicateUsesImagePrompt('black-forest-labs/flux-1.1-pro')).toBe(true);
    expect(replicateUsesImagePrompt('black-forest-labs/flux-kontext-pro')).toBe(false);
    expect(replicateAspect(1000, 1000)).toBe('1:1');
    expect(bytesToBase64(png).length).toBeGreaterThan(0);
  });
});

function requestUrl(input: Parameters<typeof fetch>[0] | undefined): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return '';
}
