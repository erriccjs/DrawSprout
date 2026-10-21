import { describe, expect, it } from 'vitest';
import { flatColourRegions, lineArtImage, paletteName } from './flat-colour';
import type { RgbaImage } from './png';

function painted(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => readonly [number, number, number],
): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colorAt(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

describe('flat colouring page', () => {
  it('maps swatches in Lab and keeps white, black, and dark brown', () => {
    expect(paletteName({ r: 220, g: 90, b: 20 })).toBe('oranye');
    expect(paletteName({ r: 236, g: 234, b: 230 })).toBe('putih');
    expect(paletteName({ r: 140, g: 140, b: 140 })).toBe('abu-abu');
    expect(paletteName({ r: 72, g: 42, b: 24 })).toBe('cokelat tua');
    expect(paletteName({ r: 120, g: 20, b: 30 })).toBe('merah');
    expect(paletteName({ r: 20, g: 20, b: 20 })).toBe('hitam');
  });

  it('closes a white cup and a dark-brown coffee inside black outlines', () => {
    const cup = painted(48, 36, (x, y) => {
      const outline = x >= 6 && x < 42 && y >= 4 && y < 32 && (x < 8 || x >= 40 || y < 6 || y >= 30);
      if (outline) return [0, 0, 0];
      if (x >= 16 && x < 32 && y >= 14 && y < 26) return [72, 42, 24];
      if (x >= 8 && x < 40 && y >= 6 && y < 30) return [255, 255, 255];
      return [40, 160, 50];
    });
    const names = flatColourRegions(cup).map((region) => region.name);
    expect(names).toContain('putih');
    expect(names).toContain('cokelat tua');
    expect(names).not.toContain('hijau');
    const lines = lineArtImage(cup);
    let ink = 0;
    for (let index = 0; index < lines.data.length; index += 4) {
      if ((lines.data[index] ?? 255) < 40) ink += 1;
    }
    expect(ink).toBeGreaterThan(20);
  });

  it('turns a solid black body into a black fill plus an outline', () => {
    const dog = painted(48, 36, (x, y) => (x >= 8 && x < 40 && y >= 6 && y < 30 ? [20, 20, 20] : [255, 255, 255]));
    expect(flatColourRegions(dog).some((region) => region.name === 'hitam')).toBe(true);
    const lines = lineArtImage(dog);
    let ink = 0;
    for (let index = 0; index < lines.data.length; index += 4) {
      if ((lines.data[index] ?? 255) < 40) ink += 1;
    }
    expect(ink).toBeGreaterThan(20);
  });

  it('drops a green frame and keeps the grey centre', () => {
    const framed = painted(40, 40, (x, y) => {
      const nx = x / 39;
      const ny = y / 39;
      if (nx < 0.1 || nx > 0.9 || ny < 0.1 || ny > 0.9) return [40, 160, 50];
      return [150, 150, 150];
    });
    const names = flatColourRegions(framed).map((region) => region.name);
    expect(names).toContain('abu-abu');
    expect(names).not.toContain('hijau');
  });
});
