import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import worker from './index';

const png = Uint8Array.from([137, 80, 78, 71]);

describe('worker routing', () => {
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
    expect(source).not.toMatch(/images\/edits/);
  });
});
