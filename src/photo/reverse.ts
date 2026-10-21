/**
 * Reverse construction. A finished line drawing is edited, at low quality,
 * to remove one planned part at a time. Each step image is still that drawing,
 * so the steps cannot drift apart the way a fresh illustration can.
 * The default lesson does not do this. The harness asks for it (D-77).
 */

import type { RgbaImage } from './png';

/** Enough to compare, and cheap enough to stay near $0.25 a photo with call A and call B. */
export const MAX_REVERSE_ERASES = 5;

/** Dark pixels that are in `current` and not already in `previous`. */
export function subtractInk(previous: RgbaImage, current: RgbaImage): RgbaImage | null {
  if (previous.width !== current.width || previous.height !== current.height) return null;
  const { width, height } = current;
  const prior = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!dark(previous, x, y)) continue;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
          prior[sy * width + sx] = 1;
        }
      }
    }
  }
  const data = new Uint8Array(width * height * 4);
  let marks = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const on = dark(current, x, y) && prior[y * width + x] !== 1;
      if (on) marks += 1;
      const offset = (y * width + x) * 4;
      data[offset] = on ? 0 : 255;
      data[offset + 1] = on ? 0 : 255;
      data[offset + 2] = on ? 0 : 255;
      data[offset + 3] = 255;
    }
  }
  if (marks < 12) return null;
  return { width, height, data };
}

function dark(image: RgbaImage, x: number, y: number): boolean {
  const offset = (y * image.width + x) * 4;
  const lum = 0.2126 * (image.data[offset] ?? 255)
    + 0.7152 * (image.data[offset + 1] ?? 255)
    + 0.0722 * (image.data[offset + 2] ?? 255);
  return lum < 160;
}
