import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const png = Uint8Array.from([137, 80, 78, 71]);

function allowingLimit() {
  return {
    idFromName: (name: string) => ({ name }),
    get: () => ({ allow: () => Promise.resolve(true) }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('worker routing', () => {
  it('keeps the static shell on the assets binding and only owns /api', async () => {
    const config = readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(config).toContain('"main": "src/worker/index.ts"');
    expect(config).toContain('"run_worker_first": ["/api/*"]');
    expect(config).toContain('"not_found_handling": "single-page-application"');
    expect(config).toContain('"previews": {}');
    expect(config).toContain('"class_name": "PaidRateLimit"');
    expect(config).toContain('"tag": "v1-paid-rate-limit"');
    expect(config).not.toContain('@cloudflare/vite-plugin');

    const env = {
      ASSETS: {
        fetch(input: RequestInfo | URL) {
          const url = input instanceof Request ? input.url : String(input);
          return Promise.resolve(new Response(`asset:${url}`, { status: 200 }));
        },
      },
      PAID_RATE_LIMIT: allowingLimit(),
    };
    const shell = await worker.fetch(new Request('https://drawsprout.test/sw.js'), env);
    expect(await shell.text()).toContain('/sw.js');

    const missing = await worker.fetch(new Request('https://drawsprout.test/api/other'), env);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('x-content-type-options')).toBe('nosniff');
    expect(missing.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(missing.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(missing.headers.get('permissions-policy')).toContain('camera=(self)');
  });

  it('sends /api/photo-match to the matcher and leaves /sw.js on the asset layer', async () => {
    const assets: string[] = [];
    const env = {
      ASSETS: {
        fetch: (request: Request) => {
          assets.push(new URL(request.url).pathname);
          return Promise.resolve(new Response('/* service worker */', { headers: { 'content-type': 'application/javascript' } }));
        },
      },
      PAID_RATE_LIMIT: allowingLimit(),
    };
    const sw = await worker.fetch(new Request('https://drawsprout.example/sw.js'), env);
    expect(await sw.text()).toContain('service worker');
    expect(assets).toEqual(['/sw.js']);

    const missing = await worker.fetch(new Request('https://drawsprout.example/api/photo-match', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: png as unknown as BodyInit,
    }), env);
    expect(missing.status).toBe(503);

    const other = await worker.fetch(new Request('https://drawsprout.example/api/other'), env);
    expect(other.status).toBe(404);
  });

  it('does not log the photo', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/worker/index.ts'), 'utf8');
    expect(source).not.toMatch(/console\.log\([^)]*image|console\.log\([^)]*body|console\.log\([^)]*authorization/i);
    expect(source).toContain("route: 'photo-match'");
    expect(source).toContain("route: 'photo-lesson'");
    expect(source).not.toMatch(/images\/edits/);
  });

  it('logs status only when the photo route is missing its key', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const form = new FormData();
    form.set('idempotencyKey', 'worker-key-1');
    form.set('image', new File([Uint8Array.from([1, 2, 3, 4])], 'x.png', { type: 'image/png' }));
    const response = await worker.fetch(new Request('https://drawsprout.test/api/photo-lesson', { method: 'POST', body: form }), {
      ASSETS: { fetch: () => Promise.resolve(new Response('no')) },
      PAID_RATE_LIMIT: allowingLimit(),
    });
    expect(response.status).toBe(500);
    const line = JSON.parse(logs[0] ?? '{}') as { route: string; status: number };
    expect(line).toMatchObject({ route: 'photo-lesson', status: 500 });
    expect(logs.join('\n')).not.toContain('png');
    expect(logs.join('\n')).not.toMatch(/[A-Za-z0-9+/]{40,}/);
  });

  it('asks Replicate for a photo match unless MATCH_PROVIDER is openai', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const calls: { url: string; prefer: string | null; hasImageInput: boolean }[] = [];
    const secret = 'replicate-secret-value-not-for-logs';
    vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
      const body = typeof init.body === 'string' ? init.body : '';
      calls.push({
        url: String(url),
        prefer: new Headers(init.headers).get('prefer'),
        hasImageInput: body.includes('image_input'),
      });
      const output = JSON.stringify({
        category: 'cat', confidence: 0.9, facing: 'front', pose: 'sitting', colours: [{ part: 'fur', color: '#c47a2a' }],
      });
      if (String(url).includes('api.openai.com')) {
        return Promise.resolve(new Response(JSON.stringify({
          choices: [{ message: { content: output } }],
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        })));
      }
      return Promise.resolve(new Response(JSON.stringify({
        id: 'pred-worker',
        status: 'succeeded',
        output,
        metrics: { input_token_count: 20, output_token_count: 8 },
      })));
    });
    const assets = { ASSETS: { fetch: () => Promise.resolve(new Response('no')) }, PAID_RATE_LIMIT: allowingLimit() };
    const photo = () => new Request('https://drawsprout.test/api/photo-match', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: png as unknown as BodyInit,
    });
    const replicate = await worker.fetch(photo(), { ...assets, REPLICATE_API_KEY: secret });
    expect(replicate.status).toBe(200);
    const matched = await replicate.json() as { matched: boolean; category: string; model: string };
    expect(matched).toMatchObject({ matched: true, category: 'cat', model: 'openai/gpt-4.1-mini' });
    expect(calls[0]?.url).toBe('https://api.replicate.com/v1/models/openai/gpt-4.1-mini/predictions');
    expect(calls[0]?.prefer).toBe('wait=20');
    expect(calls[0]?.hasImageInput).toBe(true);
    expect(logs.join('\n')).not.toContain(secret);
    expect(logs.join('\n')).not.toContain('data:image');

    calls.length = 0;
    const openai = await worker.fetch(photo(), {
      ...assets,
      MATCH_PROVIDER: 'openai',
      OPENAI_API_KEY: 'openai-secret-value',
    });
    expect(openai.status).toBe(200);
    expect(calls[0]?.url).toContain('https://api.openai.com/v1/chat/completions');
    expect((await openai.json() as { category: string }).category).toBe('cat');
  });

  it('denies a paid match when the shared limiter cannot be reached', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      calls.push(String(url));
      return Promise.resolve(new Response('{}'));
    });
    const response = await worker.fetch(new Request('https://drawsprout.test/api/photo-match', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: png as unknown as BodyInit,
    }), {
      ASSETS: { fetch: () => Promise.resolve(new Response('no')) },
      REPLICATE_API_KEY: 'replicate-secret-value',
      PAID_RATE_LIMIT: {
        idFromName: (name: string) => ({ name }),
        get: () => ({ allow: () => Promise.reject(new Error('limiter down')) }),
      },
    });
    expect(response.status).toBe(429);
    expect(calls).toEqual([]);
  });
});
