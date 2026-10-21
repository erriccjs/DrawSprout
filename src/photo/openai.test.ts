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
      quality: 'medium',
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
    expect(form.get('quality')).toBe('medium');
    expect(form.get('size')).toBe('1536x1024');
    const prompt = form.get('prompt');
    const promptText = typeof prompt === 'string' ? prompt : '';
    expect(promptText).toContain('Do not add limbs');
    expect(promptText).toContain('closed outer silhouette');
    expect(promptText).toContain('barcode');
    expect(form.get('background')).toBe('opaque');
    expect(JSON.stringify([...form.entries()])).not.toContain('sk-test-not-real');
  });

  it('asks the text model with the illustration, the step labels, and chat token counts', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ subject: 'Kucing', title: 'Kucing', parts: [{ primitive: 'circle', name: 'kepala', pair: false, x: 1, y: 2, width: 3, height: 4, rotation: 0 }] }) } }],
      usage: { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 },
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const written = await openAiClients('sk-test-not-real').instructions.write({
      model: 'gpt-4.1-mini',
      targets: [{ id: 'part-1', primitive: 'circle', pair: false, x: 1, y: 2, width: 3, height: 4 }],
      illustrationPng: png,
      signal: AbortSignal.timeout(1000),
      idempotencyKey: 'idem-key-1',
    });
    expect(written.subject).toBe('Kucing');
    expect(written.title).toBe('Kucing');
    expect(written.parts[0]?.name).toBe('kepala');
    expect(written.parts[0]?.primitive).toBe('circle');
    expect(written.usage).toEqual({ inputTokens: 20, outputTokens: 9, totalTokens: 29 });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('idempotency-key')).toBe('idem-key-1-text');
    if (typeof init?.body !== 'string') throw new Error('expected a JSON body');
    const body = JSON.parse(init.body) as { messages: { content: { type: string; text?: string; image_url?: { url: string } }[] }[] };
    const content = body.messages[0]?.content ?? [];
    const text = content.find((part) => part.type === 'text')?.text ?? '';
    expect(text).toContain('circle');
    expect(text).toContain('latar belakang');
    expect(text).toContain('1000');
    expect(content.some((part) => part.type === 'image_url' && part.image_url?.url.startsWith('data:image/png;base64,'))).toBe(true);
  });

  it('sends low quality and a stricter prompt for the simple variant', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      data: [{ b64_json: bytesToBase64(png) }],
      usage: { input_tokens: 4, output_tokens: 6, total_tokens: 10, input_tokens_details: { text_tokens: 1, image_tokens: 3 } },
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await openAiClients('sk-test-not-real').images.edit({
      png,
      variant: 'simple',
      model: 'gpt-image-1.5',
      quality: 'low',
      width: 400,
      height: 400,
      idempotencyKey: 'simple-key',
      signal: AbortSignal.timeout(1000),
    });
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 6, totalTokens: 10, textInputTokens: 1, imageInputTokens: 3 });
    const form = fetchMock.mock.calls[0]?.[1]?.body;
    if (!(form instanceof FormData)) throw new Error('expected form data');
    expect(form.get('quality')).toBe('low');
    const prompt = form.get('prompt');
    expect(typeof prompt === 'string' ? prompt : '').toContain('Do not redesign');
  });
});
