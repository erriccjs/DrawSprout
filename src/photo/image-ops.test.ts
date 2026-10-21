import { describe, expect, it } from 'vitest';
import { applyOrientation, cropImage, downscaleLongEdge } from './image-ops';
import type { RgbaImage } from './png';

function image(width: number, height: number, fill: (x: number, y: number) => readonly [number, number, number, number]): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = fill(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
  }
  return { width, height, data };
}

function pixel(source: RgbaImage, x: number, y: number): [number, number, number, number] {
  const index = (y * source.width + x) * 4;
  return [source.data[index] ?? 0, source.data[index + 1] ?? 0, source.data[index + 2] ?? 0, source.data[index + 3] ?? 0];
}

describe('photo pixels', () => {
  it('rotates EXIF orientation 6 a quarter turn clockwise', () => {
    const source = image(2, 1, (x) => (x === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
    const turned = applyOrientation(source, 6);
    expect(turned.width).toBe(1);
    expect(turned.height).toBe(2);
    expect(pixel(turned, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixel(turned, 0, 1)).toEqual([0, 0, 255, 255]);
  });

  it('crops to the selected rectangle', () => {
    const source = image(4, 2, (x) => [x * 40, 0, 0, 255]);
    const cropped = cropImage(source, { x: 1, y: 0, width: 2, height: 2 });
    expect(cropped).toMatchObject({ width: 2, height: 2 });
    expect(pixel(cropped, 0, 0)[0]).toBe(40);
    expect(pixel(cropped, 1, 0)[0]).toBe(80);
  });

  it('downscales the long edge and keeps the aspect', () => {
    const source = image(4, 2, () => [10, 20, 30, 255]);
    const small = downscaleLongEdge(source, 2);
    expect(small.width).toBe(2);
    expect(small.height).toBe(1);
    expect(pixel(small, 0, 0)).toEqual([10, 20, 30, 255]);
  });
});
