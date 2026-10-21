import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJpegOrientation } from './jpeg-orientation';

describe('jpeg orientation', () => {
  it('reads a little-endian orientation tag', () => {
    const bytes = jpegWithOrientation(6);
    expect(readJpegOrientation(bytes)).toBe(6);
  });

  it('returns 1 when the file has no Exif segment', () => {
    expect(readJpegOrientation(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]))).toBe(1);
  });

  it('finds no orientation tag in the CC0 samples', () => {
    for (const name of ['cat.jpg', 'dog.jpg', 'toy-car.jpg', 'cup.jpg', 'flower.jpg']) {
      const bytes = new Uint8Array(readFileSync(path.join(process.cwd(), 'scripts/photo-eval/samples', name)));
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(readJpegOrientation(bytes)).toBe(1);
    }
  });
});

function jpegWithOrientation(orientation: number): Uint8Array {
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ];
  const header = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const payload = [...header, ...tiff];
  const length = payload.length + 2;
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xe1, (length >> 8) & 255, length & 255,
    ...payload,
    0xff, 0xd9,
  ]);
}
