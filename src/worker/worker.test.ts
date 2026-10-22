import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const png = Uint8Array.from([137, 80, 78, 71]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('worker routing', () => {
  it('keeps the static shell on the assets binding and only owns /api', async () => {
    const config = readFileSync(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(config).toContain('"main": "src/worker/index.ts"');
    expect(config).toContain('"run_worker_first": ["/api/*"]');
    expect(config).toContain('"not_found_handling": "single-page-application"');
    expect(config).toContain('"previews": {}');
    expect(config).not.toContain('@cloudflare/vite-plugin');

    const env = {
      ASSETS: {
        fetch(input: RequestInfo | URL) {
          const url = input instanceof Request ? input.url : String(input);
          return Promise.resolve(new Response(`asset:${url}`, { status: 200 }));
        },
      },
    };
    const shell = await worker.fetch(new Request('https://drawsprout.test/sw.js'), env);
    expect(await shell.text()).toContain('/sw.js');

    const missing = await worker.fetch(new Request('https://drawsprout.test/api/other'), env);
    expect(missing.status).toBe(404);
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
    });
    expect(response.status).toBe(500);
    const line = JSON.parse(logs[0] ?? '{}') as { route: string; status: number };
    expect(line).toMatchObject({ route: 'photo-lesson', status: 500 });
    expect(logs.join('\n')).not.toContain('png');
    expect(logs.join('\n')).not.toMatch(/[A-Za-z0-9+/]{40,}/);
  });
});
