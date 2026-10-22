import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordedCalls } from '../test/fake-canvas';
import { fittedSize, matchPhotoRequest } from './photo-match-client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('match photo upload size', () => {
  it('fits the long edge to 1024 and leaves a smaller photo alone', () => {
    expect(fittedSize(4032, 3024)).toEqual({ width: 1024, height: 768 });
    expect(fittedSize(3000, 4000)).toEqual({ width: 768, height: 1024 });
    expect(fittedSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fittedSize(1024, 100)).toEqual({ width: 1024, height: 100 });
  });

  it('uploads a JPEG of the downscaled photo, not the original file', async () => {
    const closed = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve({
      width: 4032,
      height: 3024,
      close: closed,
    })));
    const canvases: HTMLCanvasElement[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = create(tagName, options);
      if (tagName === 'canvas') canvases.push(element as HTMLCanvasElement);
      return element;
    });
    const encoded = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(this: HTMLCanvasElement, callback, type, quality) {
      expect(this.width).toBe(1024);
      expect(this.height).toBe(768);
      expect(type).toBe('image/jpeg');
      expect(quality).toBe(0.85);
      callback(encoded);
    });
    let posted: RequestInit | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      posted = init;
      return Promise.resolve(new Response(JSON.stringify({
        matched: true,
        category: 'flower',
        confidence: 0.9,
        facing: 'front',
        pose: '',
        colours: [{ part: 'petals', color: '#a49f9a' }],
        suggestions: [],
        message: '',
      }), { status: 200 }));
    }));

    const original = new File([new Uint8Array(64)], 'phone.jpg', { type: 'image/jpeg' });
    const match = await matchPhotoRequest(original);

    expect(match.colours).toEqual([{ part: 'petals', color: '#a49f9a' }]);
    expect(closed).toHaveBeenCalledOnce();
    const canvas = canvases[0];
    expect(canvas).toBeDefined();
    const calls = recordedCalls(canvas!);
    expect(calls.some((call) => call.op === 'fillRect' && call.args[2] === 1024 && call.args[3] === 768)).toBe(true);
    expect(calls.some((call) => call.op === 'drawImage')).toBe(true);
    const headers = posted?.headers as Record<string, string>;
    expect(headers['content-type']).toBe('image/jpeg');
    expect(posted?.body).toBeInstanceOf(File);
    expect(posted?.body).not.toBe(original);
    expect((posted?.body as File).type).toBe('image/jpeg');
    expect((posted?.body as File).name).toBe('photo.jpg');
    expect((posted?.body as File).size).toBe(encoded.size);
  });

  it('says the photo cannot be read when the bitmap decoder fails', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.reject(new Error('decode'))));
    const original = new File([new Uint8Array([1])], 'phone.jpg', { type: 'image/jpeg' });
    await expect(matchPhotoRequest(original)).rejects.toThrow('Foto tidak dapat dibaca. Pilih gambar lain.');
  });
});
