import { describe, expect, it } from 'vitest';
import { decodePng, encodePng, reencodePng } from './png';

describe('png re-encode', () => {
  it('drops a text chunk and keeps the pixels', async () => {
    const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
    const clean = await encodePng({ width: 2, height: 1, data: pixels });
    const marked = insertText(clean, 'EXIFSECRET', 'SECRETVALUE');
    expect(new TextDecoder().decode(marked)).toContain('SECRETVALUE');

    const again = await reencodePng(marked);
    expect(new TextDecoder().decode(again)).not.toContain('SECRETVALUE');
    expect(new TextDecoder().decode(again)).not.toContain('EXIFSECRET');
    const decoded = await decodePng(again);
    expect(decoded.width).toBe(2);
    expect([...decoded.data]).toEqual([...pixels]);
  });

  it('round-trips a realistically sized image without stalling on backpressure', async () => {
    const width = 720;
    const height = 540;
    const data = new Uint8Array(width * height * 4);
    let seed = 0x12345678;
    for (let index = 0; index < data.length; index += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[index] = seed & 255;
      data[index + 1] = (seed >>> 8) & 255;
      data[index + 2] = (seed >>> 16) & 255;
      data[index + 3] = 255;
    }
    const encoded = await within(8_000, encodePng({ width, height, data }));
    const decoded = await within(8_000, decodePng(encoded));
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.data[0]).toBe(data[0]);
    expect(decoded.data[data.length - 2]).toBe(data[data.length - 2]);
    expect(decoded.data.length).toBe(data.length);
  }, 20_000);
});

function within<T>(ms: number, work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`PNG codec stalled past ${ms} ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function insertText(png: Uint8Array, keyword: string, text: string): Uint8Array {
  const payload = new TextEncoder().encode(`${keyword}\u0000${text}`);
  const chunk = new Uint8Array(12 + payload.length);
  chunk[0] = (payload.length >>> 24) & 255;
  chunk[1] = (payload.length >>> 16) & 255;
  chunk[2] = (payload.length >>> 8) & 255;
  chunk[3] = payload.length & 255;
  chunk.set([0x74, 0x45, 0x58, 0x74], 4);
  chunk.set(payload, 8);
  const end = png.findIndex((_, index) => png[index] === 0x49 && png[index + 1] === 0x45 && png[index + 2] === 0x4e && png[index + 3] === 0x44);
  const at = end - 4;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, at), 0);
  out.set(chunk, at);
  out.set(png.subarray(at), at + chunk.length);
  return out;
}
