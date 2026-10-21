/**
 * Crop, orientation, and downscale on raw pixels.
 *
 * The page uses the browser bitmap decoder, which applies the camera
 * orientation and then draws into a canvas. These functions are the same
 * transforms, testable without a canvas. Re-encoding the result is what
 * drops EXIF: the output is only pixels.
 */

import type { RgbaImage } from './png';

export interface CropRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Longest edge of a photo sent to the model. PRD section 13 allows up to 2048. */
export const PHOTO_LONG_EDGE = 1024;

/** EXIF orientation values 1 through 8. 1 is unchanged. */
export function applyOrientation(image: RgbaImage, orientation: number): RgbaImage {
  if (orientation === 1 || orientation === 0) return image;
  const { width, height, data } = image;
  const rotated = orientation >= 5 && orientation <= 8;
  const outW = rotated ? height : width;
  const outH = rotated ? width : height;
  const out = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const mapped = mapOrientation(x, y, width, height, orientation);
      const from = (y * width + x) * 4;
      const to = (mapped.y * outW + mapped.x) * 4;
      out[to] = data[from] ?? 0;
      out[to + 1] = data[from + 1] ?? 0;
      out[to + 2] = data[from + 2] ?? 0;
      out[to + 3] = data[from + 3] ?? 255;
    }
  }
  return { width: outW, height: outH, data: out };
}

export function cropImage(image: RgbaImage, crop: CropRect): RgbaImage {
  const x0 = clamp(Math.round(crop.x), 0, image.width - 1);
  const y0 = clamp(Math.round(crop.y), 0, image.height - 1);
  const x1 = clamp(Math.round(crop.x + crop.width), x0 + 1, image.width);
  const y1 = clamp(Math.round(crop.y + crop.height), y0 + 1, image.height);
  const width = x1 - x0;
  const height = y1 - y0;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((y0 + y) * image.width + x0) * 4;
    data.set(image.data.subarray(from, from + width * 4), y * width * 4);
  }
  return { width, height, data };
}

/** Composite onto white and force opaque alpha. Transparent pixels are often stored as black. */
export function flattenOnWhite(image: RgbaImage): RgbaImage {
  const data = new Uint8Array(image.data.length);
  for (let index = 0; index < data.length; index += 4) {
    const alpha = image.data[index + 3] ?? 255;
    const scale = alpha / 255;
    data[index] = Math.round((image.data[index] ?? 255) * scale + 255 * (1 - scale));
    data[index + 1] = Math.round((image.data[index + 1] ?? 255) * scale + 255 * (1 - scale));
    data[index + 2] = Math.round((image.data[index + 2] ?? 255) * scale + 255 * (1 - scale));
    data[index + 3] = 255;
  }
  return { width: image.width, height: image.height, data };
}

export function downscaleLongEdge(image: RgbaImage, longEdge = PHOTO_LONG_EDGE): RgbaImage {
  const longest = Math.max(image.width, image.height);
  if (longest <= longEdge) return image;
  const scale = longEdge / longest;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sy0 = Math.floor((y * image.height) / height);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) * image.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sx0 = Math.floor((x * image.width) / width);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) * image.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1; sy += 1) {
        for (let sx = sx0; sx < sx1; sx += 1) {
          const i = (sy * image.width + sx) * 4;
          r += image.data[i] ?? 0;
          g += image.data[i + 1] ?? 0;
          b += image.data[i + 2] ?? 0;
          a += image.data[i + 3] ?? 0;
          count += 1;
        }
      }
      const o = (y * width + x) * 4;
      data[o] = Math.round(r / count);
      data[o + 1] = Math.round(g / count);
      data[o + 2] = Math.round(b / count);
      data[o + 3] = Math.round(a / count);
    }
  }
  return { width, height, data };
}

function mapOrientation(
  x: number,
  y: number,
  width: number,
  height: number,
  orientation: number,
): { x: number; y: number } {
  switch (orientation) {
    case 2: return { x: width - 1 - x, y };
    case 3: return { x: width - 1 - x, y: height - 1 - y };
    case 4: return { x, y: height - 1 - y };
    case 5: return { x: y, y: x };
    case 6: return { x: height - 1 - y, y: x };
    case 7: return { x: height - 1 - y, y: width - 1 - x };
    case 8: return { x: y, y: width - 1 - x };
    default: return { x, y };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
