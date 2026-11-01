import { describe, expect, it } from 'vitest';
import { DOODLE_MODEL, DOODLE_PROMPT, DOODLE_SEED, doodleWithReplicate, DoodleUpstreamError } from './replicate';

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

describe('flux klein doodle', () => {
  it('sends the fixed prompt and seed, and does not put the key in the body', async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const fetchMock: typeof fetch = (url, init) => {
      const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (href.includes('/predictions')) {
        const body = typeof init?.body === 'string' ? init.body : '';
        expect(href).toContain(DOODLE_MODEL);
        expect(body).toContain(DOODLE_PROMPT.slice(0, 24));
        expect(body).toContain(`"seed":${DOODLE_SEED}`);
        expect(body).not.toContain('secret-key');
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-key');
        return Promise.resolve(new Response(JSON.stringify({
          output: 'https://replicate.delivery/example/doodle.png',
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(png, { status: 200 }));
    };
    const result = await doodleWithReplicate({
      apiKey: 'secret-key',
      jpeg,
      width: 64,
      height: 48,
      fetch: fetchMock,
    });
    expect(result[0]).toBe(137);
  });

  it('gives up after a second 429', async () => {
    let calls = 0;
    const fetchMock: typeof fetch = () => {
      calls += 1;
      return Promise.resolve(new Response('{"detail":"slow"}', {
        status: 429,
        headers: { 'retry-after': '0' },
      }));
    };
    await expect(doodleWithReplicate({
      apiKey: 'secret-key',
      jpeg,
      width: 8,
      height: 8,
      fetch: fetchMock,
    })).rejects.toBeInstanceOf(DoodleUpstreamError);
    expect(calls).toBe(2);
  });
});
