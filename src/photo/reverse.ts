/**
 * Reverse construction. A finished line drawing is edited, at low quality,
 * to remove one planned part at a time. Each step image is still that drawing,
 * so the steps cannot drift apart the way a fresh illustration can.
 * The default lesson does not do this. The harness asks for it (D-77, D-78).
 */

import type { RgbaImage } from './png';

/** Enough to compare, and cheap enough to stay near $0.25 a photo with call A and call B. */
export const MAX_REVERSE_ERASES = 5;

/**
 * Dark pixels that are in `current` and not already in `previous`.
 * `current` is shifted and scaled onto `previous` first, so a small move
 * between erase stages does not mark the whole drawing as new.
 */
export function subtractInk(previous: RgbaImage, current: RgbaImage): RgbaImage | null {
  if (previous.width !== current.width || previous.height !== current.height) return null;
  return inkAdded(previous, alignInk(previous, current));
}

/** Move `stage` into the finished drawing's frame. A null match leaves `stage` as it is. */
export function registerToFinal(finalImage: RgbaImage, stage: RgbaImage): RgbaImage {
  if (finalImage === stage) return stage;
  if (finalImage.width !== stage.width || finalImage.height !== stage.height) return stage;
  const { width, height } = finalImage;
  const target = darkMask(finalImage);
  const source = darkMask(stage);
  let darkCount = 0;
  for (const value of source) if (value) darkCount += 1;
  if (darkCount < 12) return stage;
  const samples: number[] = [];
  const stride = Math.max(1, Math.floor(darkCount / 1500));
  for (let index = 0, seen = 0; index < source.length; index += 1) {
    if (!source[index]) continue;
    seen += 1;
    if (seen % stride === 0) samples.push(index);
  }
  if (samples.length < 12) return stage;
  const maxShift = Math.max(8, Math.round(Math.min(width, height) * 0.12));
  const coarse = Math.max(1, Math.round(maxShift / 6));
  let best = { score: hitScore(samples, target, width, height, 1, 0, 0), scale: 1, dx: 0, dy: 0 };
  const consider = (scale: number, dx: number, dy: number) => {
    const score = hitScore(samples, target, width, height, scale, dx, dy);
    if (score > best.score) best = { score, scale, dx, dy };
  };
  for (const scale of [0.94, 0.97, 1, 1.03, 1.06]) {
    for (let dy = -maxShift; dy <= maxShift; dy += coarse) {
      for (let dx = -maxShift; dx <= maxShift; dx += coarse) {
        if (scale === 1 && dx === 0 && dy === 0) continue;
        consider(scale, dx, dy);
      }
    }
  }
  if (coarse > 1) {
    for (let dy = best.dy - coarse; dy <= best.dy + coarse; dy += 1) {
      for (let dx = best.dx - coarse; dx <= best.dx + coarse; dx += 1) {
        if (dx === best.dx && dy === best.dy) continue;
        consider(best.scale, dx, dy);
      }
    }
  }
  if (best.dx === 0 && best.dy === 0 && best.scale === 1) return stage;
  if (best.score < Math.min(12, samples.length * 0.15)) return stage;
  return warpInverse(stage, best.scale, best.dx, best.dy);
}

export interface InkRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Dark pixels in `current` that are not already in `previous`.
 * Both images must already share a frame. `region` keeps only the ink inside
 * that box, expanded a little, so a shifted outline outside the erased part is not new.
 */
export function inkAdded(previous: RgbaImage, current: RgbaImage, region?: InkRegion): RgbaImage | null {
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
  const padX = region ? Math.max(8, region.width * 0.18) : 0;
  const padY = region ? Math.max(8, region.height * 0.18) : 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inPart = !region
        || (x >= region.x - padX && y >= region.y - padY && x < region.x + region.width + padX && y < region.y + region.height + padY);
      const on = inPart && dark(current, x, y) && prior[y * width + x] !== 1;
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

function alignInk(reference: RgbaImage, moving: RgbaImage): RgbaImage {
  const { width, height } = reference;
  const prior = darkMask(reference);
  const next = darkMask(moving);
  let darkCount = 0;
  for (const value of prior) if (value) darkCount += 1;
  if (darkCount < 12) return moving;
  const samples: number[] = [];
  const stride = Math.max(1, Math.floor(darkCount / 1500));
  for (let index = 0, seen = 0; index < prior.length; index += 1) {
    if (!prior[index]) continue;
    seen += 1;
    if (seen % stride === 0) samples.push(index);
  }
  if (samples.length < 12) return moving;
  const maxShift = Math.max(6, Math.round(Math.min(width, height) * 0.08));
  const coarse = Math.max(1, Math.round(maxShift / 6));
  let best = { score: hitScore(samples, next, width, height, 1, 0, 0), scale: 1, dx: 0, dy: 0 };
  const consider = (scale: number, dx: number, dy: number) => {
    const score = hitScore(samples, next, width, height, scale, dx, dy);
    if (score > best.score) best = { score, scale, dx, dy };
  };
  for (const scale of [0.97, 1, 1.03]) {
    for (let dy = -maxShift; dy <= maxShift; dy += coarse) {
      for (let dx = -maxShift; dx <= maxShift; dx += coarse) {
        if (scale === 1 && dx === 0 && dy === 0) continue;
        consider(scale, dx, dy);
      }
    }
  }
  if (coarse > 1) {
    for (let dy = best.dy - coarse; dy <= best.dy + coarse; dy += 1) {
      for (let dx = best.dx - coarse; dx <= best.dx + coarse; dx += 1) {
        if (dx === best.dx && dy === best.dy) continue;
        consider(best.scale, dx, dy);
      }
    }
  }
  if (best.dx === 0 && best.dy === 0 && best.scale === 1) return moving;
  if (best.score < Math.min(12, samples.length * 0.15)) return moving;
  return warp(moving, best.scale, best.dx, best.dy);
}

function hitScore(
  samples: readonly number[],
  dark: Uint8Array,
  width: number,
  height: number,
  scale: number,
  dx: number,
  dy: number,
): number {
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  let hits = 0;
  for (const index of samples) {
    const x = index % width;
    const y = (index - x) / width;
    const sx = Math.round(cx + (x - cx) * scale + dx);
    const sy = Math.round(cy + (y - cy) * scale + dy);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
    if (dark[sy * width + sx]) hits += 1;
  }
  return hits;
}

/** `stage` pixel (x, y) lands on the final image at the forward map. Read it back from final coordinates. */
function warpInverse(image: RgbaImage, scale: number, dx: number, dy: number): RgbaImage {
  const { width, height } = image;
  const data = new Uint8Array(width * height * 4);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const safe = Math.abs(scale) < 1e-3 ? 1 : scale;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.round(cx + (x - cx - dx) / safe);
      const sy = Math.round(cy + (y - cy - dy) / safe);
      const to = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) {
        data[to] = 255;
        data[to + 1] = 255;
        data[to + 2] = 255;
        data[to + 3] = 255;
        continue;
      }
      const from = (sy * width + sx) * 4;
      data[to] = image.data[from] ?? 255;
      data[to + 1] = image.data[from + 1] ?? 255;
      data[to + 2] = image.data[from + 2] ?? 255;
      data[to + 3] = 255;
    }
  }
  return { width, height, data };
}

function warp(image: RgbaImage, scale: number, dx: number, dy: number): RgbaImage {
  const { width, height } = image;
  const data = new Uint8Array(width * height * 4);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.round(cx + (x - cx) * scale + dx);
      const sy = Math.round(cy + (y - cy) * scale + dy);
      const to = (y * width + x) * 4;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) {
        data[to] = 255;
        data[to + 1] = 255;
        data[to + 2] = 255;
        data[to + 3] = 255;
        continue;
      }
      const from = (sy * width + sx) * 4;
      data[to] = image.data[from] ?? 255;
      data[to + 1] = image.data[from + 1] ?? 255;
      data[to + 2] = image.data[from + 2] ?? 255;
      data[to + 3] = 255;
    }
  }
  return { width, height, data };
}

function darkMask(image: RgbaImage): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (dark(image, x, y)) mask[y * image.width + x] = 1;
    }
  }
  return mask;
}

function dark(image: RgbaImage, x: number, y: number): boolean {
  const offset = (y * image.width + x) * 4;
  const lum = 0.2126 * (image.data[offset] ?? 255)
    + 0.7152 * (image.data[offset + 1] ?? 255)
    + 0.0722 * (image.data[offset + 2] ?? 255);
  return lum < 160;
}
