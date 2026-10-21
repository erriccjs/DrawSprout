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
    expect(promptText).toContain('No shading, no colour');
    expect(promptText).toContain('barcode');
    expect(promptText).toContain('vertical black bars');
    expect(promptText).toContain('QR code');
    expect(promptText).toContain('close-up');
    expect(form.get('background')).toBe('opaque');
    expect(JSON.stringify([...form.entries()])).not.toContain('sk-test-not-real');
  });

  it('asks the text model with the illustration, the step labels, and chat token counts', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ sameSubject: true, subject: 'Kucing', title: 'Kucing', parts: [{ name: 'kepala', pair: false, x: 10, y: 20, width: 30, height: 40, colorName: 'oranye', points: [], pieceIds: [1], count: 1 }] }) } }],
      usage: { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 },
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const written = await openAiClients('sk-test-not-real').instructions.write({
      model: 'gpt-4.1-mini',
      photoPng: png,
      illustrationPng: png,
      signal: AbortSignal.timeout(1000),
      idempotencyKey: 'idem-key-1',
      pieces: [{ id: 0, x: 10, y: 20, width: 30, height: 40 }],
    });
    expect(written.sameSubject).toBe(true);
    expect(written.subject).toBe('Kucing');
    expect(written.title).toBe('Kucing');
    expect(written.parts[0]?.name).toBe('kepala');
    expect(written.parts[0]?.colorName).toBe('oranye');
    expect(written.parts[0]?.pieceIds).toEqual([1]);
    expect(written.parts[0]?.count).toBe(1);
    expect(written.usage).toEqual({ inputTokens: 20, outputTokens: 9, totalTokens: 29 });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('idempotency-key')).toBe('idem-key-1-text');
    if (typeof init?.body !== 'string') throw new Error('expected a JSON body');
    const body = JSON.parse(init.body) as { messages: { content: { type: string; text?: string; image_url?: { url: string } }[] }[] };
    const content = body.messages[0]?.content ?? [];
    const text = content.find((part) => part.type === 'text')?.text ?? '';
    expect(text).toContain('sameSubject');
    expect(text).toContain('latar belakang');
    expect(text).toContain('1000');
    expect(text).toContain('colorName');
    expect(text).toContain('pieceIds');
    expect(text).toContain('count');
    expect(text).toContain('kalung');
    expect(text).toContain('lidah');
    expect(text).toContain('kursi');
    expect(text).toContain('anjing');
    expect(text).toContain('cokelat tua');
    expect(text).toContain('daun');
    expect(text).toContain('bukan cangkir');
    expect(text).toContain('0. x=10');
    expect(content.filter((part) => part.type === 'image_url' && part.image_url?.url.startsWith('data:image/png;base64,')).length).toBe(2);
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

  it('colours the line drawing and sends the photo as the second image', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({
      data: [{ b64_json: bytesToBase64(png) }],
      usage: { input_tokens: 4, output_tokens: 6, total_tokens: 10 },
    }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await openAiClients('sk-test-not-real').images.edit({
      png,
      referencePng: Uint8Array.from([4, 5, 6]),
      variant: 'default',
      model: 'gpt-image-1.5',
      quality: 'medium',
      width: 800,
      height: 600,
      idempotencyKey: 'colour-key',
      signal: AbortSignal.timeout(1000),
    });
    const form = fetchMock.mock.calls[0]?.[1]?.body;
    if (!(form instanceof FormData)) throw new Error('expected form data');
    const prompt = form.get('prompt');
    const promptText = typeof prompt === 'string' ? prompt : '';
    expect(promptText).toContain('Only fill');
    expect(promptText).toContain('Keep every line exactly');
    expect(promptText).toContain('barcode');
    expect(promptText).toContain('Grey stays grey');
    expect(promptText).toContain('Red stays red');
    expect(form.getAll('image[]')).toHaveLength(2);
    expect(form.get('image')).toBeNull();
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('idempotency-key')).toBe('colour-key');
  });
});
