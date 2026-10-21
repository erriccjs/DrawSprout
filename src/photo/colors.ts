/** A few dominant colours from a photo, ignoring a near-white background. */

import type { RgbaImage } from './png';

export function dominantColors(image: RgbaImage, count = 4): string[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(Math.sqrt(image.width * image.height) / 90));
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const i = (y * image.width + x) * 4;
      const r = image.data[i] ?? 0;
      const g = image.data[i + 1] ?? 0;
      const b = image.data[i + 2] ?? 0;
      const a = image.data[i + 3] ?? 255;
      if (a < 128) continue;
      if (0.2126 * r + 0.7152 * g + 0.0722 * b > 242) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const ranked = [...buckets.values()].sort((left, right) => right.n - left.n).slice(0, count);
  if (ranked.length === 0) return ['#e8552d'];
  return ranked.map((bucket) => hex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n));
}

export function sampleColor(image: RgbaImage, nx: number, ny: number): string {
  const x = clamp(Math.round(nx * (image.width - 1)), 0, image.width - 1);
  const y = clamp(Math.round(ny * (image.height - 1)), 0, image.height - 1);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const sx = clamp(x + dx, 0, image.width - 1);
      const sy = clamp(y + dy, 0, image.height - 1);
      const i = (sy * image.width + sx) * 4;
      r += image.data[i] ?? 0;
      g += image.data[i + 1] ?? 0;
      b += image.data[i + 2] ?? 0;
      n += 1;
    }
  }
  return hex(r / n, g / n, b / n);
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Average of the non-white pixels around a normalised point. White is background. */
export function sampleRegionRgb(image: RgbaImage, nx: number, ny: number): Rgb | null {
  const reach = 0.04;
  let r = 0;
  let g = 0;
  let b = 0;
  let coloured = 0;
  let seen = 0;
  for (let gy = 0; gy < 5; gy += 1) {
    for (let gx = 0; gx < 5; gx += 1) {
      const sx = clamp(Math.round((nx + ((gx - 2) * reach) / 2) * (image.width - 1)), 0, image.width - 1);
      const sy = clamp(Math.round((ny + ((gy - 2) * reach) / 2) * (image.height - 1)), 0, image.height - 1);
      const index = (sy * image.width + sx) * 4;
      const pr = image.data[index] ?? 0;
      const pg = image.data[index + 1] ?? 0;
      const pb = image.data[index + 2] ?? 0;
      const pa = image.data[index + 3] ?? 255;
      seen += 1;
      if (pa < 128) continue;
      if (0.2126 * pr + 0.7152 * pg + 0.0722 * pb > 242) continue;
      r += pr;
      g += pg;
      b += pb;
      coloured += 1;
    }
  }
  if (coloured < 3 || coloured / seen < 0.2) return null;
  return { r: r / coloured, g: g / coloured, b: b / coloured };
}

export function rgbToHex(rgb: Rgb): string {
  return hex(rgb.r, rgb.g, rgb.b);
}

export function rgbDistance(left: Rgb, right: Rgb): number {
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

export function nearestColor(color: string, palette: readonly string[]): string {
  const rgb = parseHex(color);
  let best = palette[0] ?? '#e8552d';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const other = parseHex(candidate);
    const distance = (rgb.r - other.r) ** 2 + (rgb.g - other.g) ** 2 + (rgb.b - other.b) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function hex(r: number, g: number, b: number): string {
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function byte(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function parseHex(color: string): { r: number; g: number; b: number } {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
