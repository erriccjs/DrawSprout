import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64, openAiClients } from './openai';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAI client', () => {
  it('forwards the idempotency key and does not put the secret in the body', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      data: [{ b64_json: bytesToBase64(png) }],
      usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 },
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);

    const clients = openAiClients('sk-test-not-real');
    const result = await clients.images.edit({
      png,
      variant: 'faithful',
      model: 'gpt-image-1.5',
      width: 800,
      height: 600,
      idempotencyKey: 'idem-key-1',
      signal: AbortSignal.timeout(1000),
    });
    expect(result.png[0]).toBe(137);
    expect(result.usage?.totalTokens).toBe(5);
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('idempotency-key')).toBe('idem-key-1');
    expect(headers.get('authorization')).toBe('Bearer sk-test-not-real');
    const form = init?.body;
    if (!(form instanceof FormData)) throw new Error('expected form data');
    expect(form.get('model')).toBe('gpt-image-1.5');
    expect(form.get('size')).toBe('1536x1024');
    const prompt = form.get('prompt');
    expect(typeof prompt === 'string' ? prompt : '').toContain('Do not add limbs');
    expect(JSON.stringify([...form.entries()])).not.toContain('sk-test-not-real');
  });

  it('asks the text model with a separate idempotency key', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ title: 'Kucing', steps: [{ id: 'outline-1', instruction: 'Gambar badan kucing.' }] }) } }],
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const written = await openAiClients('sk-test-not-real').instructions.write({
      model: 'gpt-4.1-mini',
      steps: [{ id: 'outline-1', phase: 'outline' }],
      signal: AbortSignal.timeout(1000),
      idempotencyKey: 'idem-key-1',
    });
    expect(written.title).toBe('Kucing');
    expect(written.instructions.get('outline-1')).toBe('Gambar badan kucing.');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('idempotency-key')).toBe('idem-key-1-text');
  });
});
