import { describe, expect, it } from 'vitest';
import {
  DOODLE_MODEL,
  DOODLE_PROMPT,
  DOODLE_SEED,
  doodleImageField,
  doodleModelFor,
  doodleWithReplicate,
  DoodleUpstreamError,
} from './replicate';

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
        expect(body).toContain('"aspect_ratio":"match_input_image"');
        // kontext takes one image under input_image, not a list.
        expect(body).toContain('"input_image":"data:image/jpeg;base64,');
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
      fetch: fetchMock,
    })).rejects.toBeInstanceOf(DoodleUpstreamError);
    expect(calls).toBe(2);
  });

  it('sends the photo under the key each model family expects', async () => {
    const seen: string[] = [];
    const png = Uint8Array.from([137, 80, 78, 71]);
    const fetchMock: typeof fetch = (url, init) => {
      const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (href.includes('/predictions')) {
        seen.push(typeof init?.body === 'string' ? init.body : '');
        return Promise.resolve(new Response(JSON.stringify({
          output: 'https://replicate.delivery/example/doodle.png',
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(png, { status: 200 }));
    };
    for (const model of [
      'black-forest-labs/flux-2-klein-4b',
      'black-forest-labs/flux-2-pro',
      'black-forest-labs/flux-kontext-max',
    ]) {
      await doodleWithReplicate({ apiKey: 'k', jpeg, model, fetch: fetchMock });
    }
    expect(seen[0]).toContain('"images":["data:image/jpeg');
    expect(seen[1]).toContain('"input_images":["data:image/jpeg');
    expect(seen[2]).toContain('"input_image":"data:image/jpeg');
  });

  it('calls the model it was configured with, and the default otherwise', async () => {
    const hrefs: string[] = [];
    const png = Uint8Array.from([137, 80, 78, 71]);
    const fetchMock: typeof fetch = (url) => {
      const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (href.includes('/predictions')) {
        hrefs.push(href);
        return Promise.resolve(new Response(JSON.stringify({
          output: 'https://replicate.delivery/example/doodle.png',
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(png, { status: 200 }));
    };
    await doodleWithReplicate({ apiKey: 'k', jpeg, model: 'someone/other-model', fetch: fetchMock });
    await doodleWithReplicate({ apiKey: 'k', jpeg, model: 'not a model id', fetch: fetchMock });
    expect(hrefs[0]).toContain('someone/other-model');
    expect(hrefs[1]).toContain(DOODLE_MODEL);
  });

  it('picks the image field from the model family', () => {
    expect(doodleImageField('black-forest-labs/flux-kontext-pro')).toBe('input_image');
    expect(doodleImageField('black-forest-labs/flux-2-klein-4b')).toBe('images');
    expect(doodleImageField('black-forest-labs/flux-2-pro')).toBe('input_images');
    expect(doodleImageField('black-forest-labs/flux-2-flex')).toBe('input_images');
  });

  it('falls back to the default for a missing or malformed model id', () => {
    expect(doodleModelFor(undefined)).toBe(DOODLE_MODEL);
    expect(doodleModelFor('  ')).toBe(DOODLE_MODEL);
    expect(doodleModelFor('no-slash')).toBe(DOODLE_MODEL);
    expect(doodleModelFor(' owner/name ')).toBe('owner/name');
  });

  it('keeps the prompt free of a negative list', () => {
    expect(DOODLE_PROMPT.toLowerCase()).not.toMatch(/\bno\b|\bwithout\b|\bnot\b/);
  });
});
