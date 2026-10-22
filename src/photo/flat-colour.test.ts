import { describe, expect, it } from 'vitest';
import { flatColourRegions, lineArtImage, paletteName, regionsColouredBy } from './flat-colour';
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
    expect(paletteName({ r: 210, g: 40, b: 45 })).toBe('merah');
    expect(paletteName({ r: 52, g: 40, b: 32 })).toBe('cokelat tua');
    expect(paletteName({ r: 48, g: 46, b: 44 })).toBe('hitam');
    expect(paletteName({ r: 150, g: 145, b: 140 })).toBe('abu-abu');
    expect(paletteName({ r: 20, g: 20, b: 20 })).toBe('hitam');
    expect(paletteName({ r: 210, g: 208, b: 204 })).toBe('abu-abu');
    expect(paletteName({ r: 236, g: 234, b: 230 })).toBe('putih');
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

  it('colours enclosed areas of the line drawing from the aligned page', () => {
    const lines = painted(48, 36, (x, y) => {
      const outer = x >= 6 && x < 42 && y >= 4 && y < 32 && (x < 8 || x >= 40 || y < 6 || y >= 30);
      const inner = x >= 18 && x < 30 && y >= 14 && y < 24 && (x < 20 || x >= 28 || y < 16 || y >= 22);
      return outer || inner ? [0, 0, 0] : [255, 255, 255];
    });
    const coloured = painted(48, 36, (x, y) => {
      if (x >= 20 && x < 28 && y >= 16 && y < 22) return [40, 70, 210];
      if (x >= 8 && x < 40 && y >= 6 && y < 30) return [210, 40, 45];
      return [40, 160, 50];
    });
    const sampled = regionsColouredBy(lines, coloured);
    const names = sampled.regions.map((region) => region.name).sort();
    expect(names).toEqual(['biru', 'merah']);
    expect(sampled.mixed).toBe(false);
    expect(sampled.regions.every((region) => region.mixed !== true)).toBe(true);
  });

  it('skips white paper and flags a region that holds two colours', () => {
    const lines = painted(48, 36, (x, y) => (
      x >= 6 && x < 42 && y >= 4 && y < 32 && (x < 8 || x >= 40 || y < 6 || y >= 30) ? [0, 0, 0] : [255, 255, 255]
    ));
    const white = painted(48, 36, () => [255, 255, 255]);
    expect(regionsColouredBy(lines, white).regions).toHaveLength(0);
    const mixed = painted(48, 36, (x, y) => {
      if (x < 8 || x >= 40 || y < 6 || y >= 30) return [255, 255, 255];
      return x < 24 ? [210, 40, 45] : [40, 70, 210];
    });
    const sampled = regionsColouredBy(lines, mixed);
    expect(sampled.regions).toHaveLength(1);
    expect(sampled.mixed).toBe(true);
    expect(sampled.regions[0]?.mixed).toBe(true);
    expect(['merah', 'biru']).toContain(sampled.regions[0]?.name);
  });

  it('samples the eroded interior, so a black edge does not turn a red collar black', () => {
    const lines = painted(64, 48, (x, y) => (
      x >= 8 && x < 56 && y >= 8 && y < 40 && (x < 11 || x >= 53 || y < 11 || y >= 37) ? [0, 0, 0] : [255, 255, 255]
    ));
    const coloured = painted(64, 48, (x, y) => {
      if (x < 6 || x >= 58 || y < 6 || y >= 42) return [255, 255, 255];
      if (x < 16 || x >= 48 || y < 16 || y >= 34) return [10, 10, 10];
      return [200, 36, 40];
    });
    const sampled = regionsColouredBy(lines, coloured);
    expect(sampled.regions.map((region) => region.name)).toEqual(['merah']);
    expect(sampled.regions[0]?.hex).not.toBe('#8d8d8d');
    expect(sampled.regions[0]?.hex.startsWith('#c') || sampled.regions[0]?.hex.startsWith('#d') || sampled.regions[0]?.hex.startsWith('#b')).toBe(true);
    const shifted = painted(64, 48, (x, y) => {
      const sx = x - 3;
      const sy = y - 2;
      if (sx < 6 || sx >= 58 || sy < 6 || sy >= 42) return [255, 255, 255];
      if (sx < 16 || sx >= 48 || sy < 16 || sy >= 34) return [10, 10, 10];
      return [200, 36, 40];
    });
    expect(regionsColouredBy(lines, shifted).regions[0]?.name).toBe('merah');
  });

  it('names dark coffee from the sample and snaps the fill to that brown', () => {
    const lines = painted(48, 36, (x, y) => (
      x >= 6 && x < 42 && y >= 4 && y < 32 && (x < 8 || x >= 40 || y < 6 || y >= 30) ? [0, 0, 0] : [255, 255, 255]
    ));
    const coloured = painted(48, 36, (x, y) => (
      x >= 8 && x < 40 && y >= 6 && y < 30 ? [52, 40, 32] : [255, 255, 255]
    ));
    const region = regionsColouredBy(lines, coloured).regions[0];
    expect(region?.name).toBe('cokelat tua');
    expect(region?.hex).not.toBe('#8d8d8d');
    const red = Number.parseInt(region?.hex.slice(1, 3) ?? 'ff', 16);
    expect(red).toBeLessThan(96);
  });

  it('keeps one large grey region when interior lines slice the face, and keeps a red collar', () => {
    const lines = painted(96, 72, (x, y) => {
      const outer = x >= 8 && x < 88 && y >= 6 && y < 66 && (x < 10 || x >= 86 || y < 8 || y >= 64);
      const whisker = y === 24 || y === 36 || y === 48;
      const collar = x >= 62 && x < 82 && y >= 46 && y < 60 && (x < 64 || x >= 80 || y < 48 || y >= 58);
      return outer || (whisker && x >= 12 && x < 84) || collar ? [0, 0, 0] : [255, 255, 255];
    });
    const coloured = painted(96, 72, (x, y) => {
      if (x < 10 || x >= 86 || y < 8 || y >= 64) return [255, 255, 255];
      if (x >= 64 && x < 80 && y >= 48 && y < 58) return [200, 36, 40];
      return [200, 198, 196];
    });
    const sampled = regionsColouredBy(lines, coloured);
    const grey = sampled.regions.filter((region) => region.name === 'abu-abu');
    expect(grey).toHaveLength(1);
    expect(sampled.regions.some((region) => region.name === 'merah')).toBe(true);
    const red = sampled.regions.find((region) => region.name === 'merah');
    expect((grey[0]?.pixels ?? 0) > (red?.pixels ?? 0) * 3).toBe(true);
  });
});
