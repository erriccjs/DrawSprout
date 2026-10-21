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
});

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
