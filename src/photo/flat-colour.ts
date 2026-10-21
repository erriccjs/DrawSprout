/**
 * One flat colouring-book page supplies both the ink and the fills.
 *
 * Dark strokes become the line art. Enclosed areas between those strokes are
 * the colour regions, so a fill is closed by construction and the page
 * background never becomes a colour. See D-73.
 */

import type { RgbaImage } from './png';
import { traceInk, type Point } from './trace';

export interface FlatRegion {
  readonly name: string;
  readonly hex: string;
  /** Closed outline in image pixels. */
  readonly points: readonly Point[];
  readonly pixels: number;
  readonly cx: number;
  readonly cy: number;
  /** The enclosed area held more than one colour. The name is still the mode. */
  readonly mixed?: boolean;
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** `rgb` is the Lab anchor. `hex` is the fill a child sees. Dark red and dark blue need anchors nearer those samples than a bright swatch. */
const SWATCHES: readonly { readonly name: string; readonly hex: string; readonly rgb: Rgb }[] = [
  { name: 'putih', hex: '#ffffff', rgb: { r: 255, g: 255, b: 255 } },
  { name: 'hitam', hex: '#1a1a1a', rgb: { r: 26, g: 26, b: 26 } },
  { name: 'abu-abu', hex: '#8d8d8d', rgb: { r: 141, g: 141, b: 141 } },
  { name: 'cokelat tua', hex: '#4a2c16', rgb: { r: 74, g: 44, b: 22 } },
  { name: 'cokelat', hex: '#a06a3c', rgb: { r: 160, g: 106, b: 60 } },
  { name: 'merah', hex: '#c62828', rgb: { r: 150, g: 32, b: 40 } },
  { name: 'merah muda', hex: '#e07098', rgb: { r: 224, g: 112, b: 152 } },
  { name: 'oranye', hex: '#e07020', rgb: { r: 224, g: 112, b: 32 } },
  { name: 'kuning', hex: '#e2c04a', rgb: { r: 226, g: 192, b: 74 } },
  { name: 'hijau', hex: '#3aaa55', rgb: { r: 58, g: 170, b: 85 } },
  { name: 'biru', hex: '#3a6fd0', rgb: { r: 42, g: 72, b: 196 } },
  { name: 'ungu', hex: '#7a4bb5', rgb: { r: 122, g: 75, b: 181 } },
];

const LAB = SWATCHES.map((swatch) => ({ ...swatch, lab: toLab(swatch.rgb) }));

/** Nearest Indonesian colour in Lab. Light grey stays grey; only near-paper white is putih. */
export function paletteName(rgb: Rgb): string {
  const lum = luminance(rgb);
  const sat = saturation(rgb);
  if (sat < 0.14 && lum >= 232) return 'putih';
  if (lum < 48 && sat < 0.22) return 'hitam';
  if (lum < 110 && rgb.g > rgb.b && rgb.r > rgb.b + 8 && rgb.r < rgb.g * 2.2 && sat >= 0.1) return lum < 72 ? 'cokelat tua' : 'cokelat';
  if (lum < 85 && sat < 0.18) return 'hitam';
  if (sat < 0.16 && lum >= 88 && lum < 232) return 'abu-abu';
  if (redNotOrange(rgb, sat)) return 'merah';
  const sample = toLab(rgb);
  let best = LAB[0] ?? { name: 'abu-abu', hex: '#8d8d8d' };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const swatch of LAB) {
    const distance = (sample.l - swatch.lab.l) ** 2 + (sample.a - swatch.lab.a) ** 2 + (sample.b - swatch.lab.b) ** 2;
    if (distance < bestDistance) {
      best = swatch;
      bestDistance = distance;
    }
  }
  return best.name;
}

export function paletteHex(name: string): string {
  return SWATCHES.find((swatch) => swatch.name === name)?.hex ?? '#e07020';
}

export function readFlatIllustration(image: RgbaImage): { lineArt: RgbaImage; regions: FlatRegion[] } {
  const { width, height } = image;
  const line = lineMask(image);
  hollowSolids(line, width, height);
  const radius = width < 64 || height < 64 ? 1 : 2;
  const barrier = erodeMask(dilateMask(line, width, height, radius), width, height, radius);
  const lineArt = paintMask(line, width, height);
  const regions = barrier.some((value) => value === 1)
    ? enclosedRegions(image, barrier)
    : openRegions(image);
  return { lineArt, regions };
}

export function flatColourRegions(image: RgbaImage): FlatRegion[] {
  return readFlatIllustration(image).regions;
}

export function lineArtImage(image: RgbaImage): RgbaImage {
  return readFlatIllustration(image).lineArt;
}

/**
 * Enclosed areas of a line drawing, coloured from a second image that shares
 * its pixels. White paper is not a fill. A region that is not one colour is
 * marked `mixed` and still keeps a single mode.
 */
export function regionsColouredBy(lineArt: RgbaImage, coloured: RgbaImage): { regions: FlatRegion[]; mixed: boolean } {
  const fitted = sameSize(lineArt, coloured) ? coloured : scaleNearest(coloured, lineArt.width, lineArt.height);
  const aligned = registerToLines(lineArt, fitted);
  const { width, height } = lineArt;
  const line = lineMask(lineArt);
  const radius = Math.min(width, height) >= 800 ? 3 : (width < 64 || height < 64 ? 1 : 2);
  const barrier = erodeMask(dilateMask(line, width, height, radius), width, height, radius);
  if (!barrier.some((value) => value === 1)) return { regions: [], mixed: false };
  const inside = interiorMask(barrier, width, height);
  return colourComponents(aligned, inside, line, width, height);
}

/** Shift and scale the colour page so its dark lines land on the line drawing. */
function registerToLines(lineArt: RgbaImage, coloured: RgbaImage): RgbaImage {
  const { width, height } = lineArt;
  const line = lineMask(lineArt);
  const dark = darkMask(coloured);
  const samples: number[] = [];
  const stride = Math.max(1, Math.floor(line.reduce((count, value) => count + value, 0) / 1800));
  for (let index = 0, seen = 0; index < line.length; index += 1) {
    if (!line[index]) continue;
    seen += 1;
    if (seen % stride === 0) samples.push(index);
  }
  if (samples.length < 20) return coloured;
  const maxShift = Math.max(2, Math.round(Math.min(width, height) * 0.04));
  const step = Math.max(1, Math.round(maxShift / 4));
  let best = { score: hitScore(samples, dark, width, height, 1, 0, 0), scale: 1, dx: 0, dy: 0 };
  for (const scale of [0.97, 1, 1.03]) {
    for (let dy = -maxShift; dy <= maxShift; dy += step) {
      for (let dx = -maxShift; dx <= maxShift; dx += step) {
        if (scale === 1 && dx === 0 && dy === 0) continue;
        const score = hitScore(samples, dark, width, height, scale, dx, dy);
        if (score > best.score) best = { score, scale, dx, dy };
      }
    }
  }
  if (best.dx === 0 && best.dy === 0 && best.scale === 1) return coloured;
  return warp(coloured, best.scale, best.dx, best.dy);
}

function hitScore(samples: readonly number[], dark: Uint8Array, width: number, height: number, scale: number, dx: number, dy: number): number {
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
  for (let index = 0, pixel = 0; index < mask.length; index += 1, pixel += 4) {
    const lum = 0.2126 * (image.data[pixel] ?? 255) + 0.7152 * (image.data[pixel + 1] ?? 255) + 0.0722 * (image.data[pixel + 2] ?? 255);
    if (lum < 90) mask[index] = 1;
  }
  return mask;
}

function redNotOrange(rgb: Rgb, sat: number): boolean {
  if (sat < 0.45 || rgb.r < 140 || rgb.g >= 80) return false;
  return rgb.r > rgb.g * 2.4 && rgb.r > rgb.b * 1.8;
}

function sameSize(left: RgbaImage, right: RgbaImage): boolean {
  return left.width === right.width && left.height === right.height;
}

function scaleNearest(image: RgbaImage, width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(image.height - 1, Math.round((y * (image.height - 1)) / Math.max(1, height - 1)));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(image.width - 1, Math.round((x * (image.width - 1)) / Math.max(1, width - 1)));
      const from = (sy * image.width + sx) * 4;
      const to = (y * width + x) * 4;
      data[to] = image.data[from] ?? 0;
      data[to + 1] = image.data[from + 1] ?? 0;
      data[to + 2] = image.data[from + 2] ?? 0;
      data[to + 3] = 255;
    }
  }
  return { width, height, data };
}

function interiorMask(barrier: Uint8Array, width: number, height: number): Uint8Array {
  const exterior = new Uint8Array(barrier.length);
  const stack = new Int32Array(barrier.length);
  let top = 0;
  const push = (index: number) => {
    if (index < 0 || index >= barrier.length || exterior[index] || barrier[index]) return;
    exterior[index] = 1;
    stack[top] = index;
    top += 1;
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (top > 0) {
    top -= 1;
    const index = stack[top] ?? 0;
    const x = index % width;
    if (x > 0) push(index - 1);
    if (x + 1 < width) push(index + 1);
    if (index >= width) push(index - width);
    if (index + width < barrier.length) push(index + width);
  }
  const inside = new Uint8Array(barrier.length);
  for (let index = 0; index < inside.length; index += 1) {
    if (!barrier[index] && !exterior[index]) inside[index] = 1;
  }
  return inside;
}

function colourComponents(coloured: RgbaImage, mask: Uint8Array, line: Uint8Array, width: number, height: number): { regions: FlatRegion[]; mixed: boolean } {
  const ids = new Int32Array(mask.length);
  const stack = new Int32Array(mask.length);
  const stats: Array<{ id: number; pixels: number; minX: number; minY: number; maxX: number; maxY: number }> = [];
  let next = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || ids[start]) continue;
    next += 1;
    let top = 0;
    ids[start] = next;
    stack[top] = start;
    top += 1;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      top -= 1;
      const index = stack[top] ?? 0;
      pixels += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || !mask[neighbor] || ids[neighbor]) continue;
        ids[neighbor] = next;
        stack[top] = neighbor;
        top += 1;
      }
    }
    stats.push({ id: next, pixels, minX, minY, maxX, maxY });
  }
  const minimum = Math.max(20, Math.round(width * height * 0.00015));
  const ranked = stats.filter((stat) => stat.pixels >= minimum).sort((left, right) => right.pixels - left.pixels).slice(0, 24);
  const colourOf = new Map<number, { name: string; hex: string; mixed: boolean }>();
  let mixed = false;
  for (const stat of ranked) {
    const sampled = sampleRegion(coloured, ids, stat.id, width, height);
    if (!sampled || sampled.name === 'putih') continue;
    if (sampled.mixed) mixed = true;
    colourOf.set(stat.id, sampled);
  }
  const parent = new Int32Array(next + 1);
  for (let id = 0; id <= next; id += 1) parent[id] = id;
  const bridge = Math.min(width, height) >= 800 ? 6 : 4;
  linkSameColour(ids, colourOf, parent, width, height, bridge);
  const merged = new Int32Array(ids.length);
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index] ?? 0;
    if (!id || !colourOf.has(id)) continue;
    merged[index] = findRoot(parent, id);
  }
  const grouped = new Map<number, { pixels: number; minX: number; minY: number; maxX: number; maxY: number; sources: number }>();
  for (const stat of ranked) {
    if (!colourOf.has(stat.id)) continue;
    const root = findRoot(parent, stat.id);
    const row = grouped.get(root) ?? { pixels: 0, minX: width, minY: height, maxX: 0, maxY: 0, sources: 0 };
    row.pixels += stat.pixels;
    row.sources += 1;
    if (stat.minX < row.minX) row.minX = stat.minX;
    if (stat.minY < row.minY) row.minY = stat.minY;
    if (stat.maxX > row.maxX) row.maxX = stat.maxX;
    if (stat.maxY > row.maxY) row.maxY = stat.maxY;
    grouped.set(root, row);
  }
  let regions: FlatRegion[] = [];
  for (const [root, row] of grouped) {
    const sampled = colourOf.get(root) ?? [...colourOf.entries()].find(([id]) => findRoot(parent, id) === root)?.[1];
    if (!sampled) continue;
    const points = shapeOf(merged, root, width, row.minX, row.minY, row.maxX, row.maxY, row.sources > 1 ? bridge : 0);
    if (!points || points.length < 4) continue;
    const spot = memberPoint(merged, root, width);
    regions.push({
      name: sampled.name,
      hex: sampled.hex,
      points,
      pixels: row.pixels,
      cx: spot.x,
      cy: spot.y,
      mixed: sampled.mixed,
    });
  }
  regions.sort((left, right) => right.pixels - left.pixels);
  const interior = mask.reduce((count, value) => count + value, 0);
  const largest = regions[0]?.pixels ?? 0;
  if (largest > 0 && largest < interior * 0.34) {
    const body = coarseBody(coloured, line, width, height);
    if (body && body.pixels > largest * 1.5) {
      regions = [body, ...regions.filter((region) => region.name !== body.name)];
    }
  }
  regions = dropTinyRegions(regions, width * height);
  return { regions, mixed };
}

/** Join areas of one colour that interior lines sliced apart. A different colour stays apart. */
function linkSameColour(
  ids: Int32Array,
  colourOf: ReadonlyMap<number, { name: string }>,
  parent: Int32Array,
  width: number,
  height: number,
  radius: number,
): void {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = ids[y * width + x] ?? 0;
      const colour = id ? colourOf.get(id)?.name : undefined;
      if (!id || !colour) continue;
      for (let step = 1; step <= radius; step += 1) {
        if (x + step < width) {
          const other = ids[y * width + x + step] ?? 0;
          if (other && other !== id && colourOf.get(other)?.name === colour) unite(parent, id, other);
        }
        if (y + step < height) {
          const other = ids[(y + step) * width + x] ?? 0;
          if (other && other !== id && colourOf.get(other)?.name === colour) unite(parent, id, other);
        }
      }
    }
  }
}

function findRoot(parent: Int32Array, id: number): number {
  let cursor = id;
  while ((parent[cursor] ?? cursor) !== cursor) cursor = parent[cursor] ?? cursor;
  let again = id;
  while (again !== cursor) {
    const next = parent[again] ?? cursor;
    parent[again] = cursor;
    again = next;
  }
  return cursor;
}

function unite(parent: Int32Array, left: number, right: number): void {
  const rootLeft = findRoot(parent, left);
  const rootRight = findRoot(parent, right);
  if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
}

function dropTinyRegions(regions: readonly FlatRegion[], imageArea: number): FlatRegion[] {
  const largest = regions.reduce((max, region) => Math.max(max, region.pixels), 0);
  const floor = Math.max(24, imageArea * 0.004);
  return regions.filter((region) => region.pixels >= largest * 0.02 || region.pixels >= floor);
}

/** One fill for the area inside the outer lines, when thin interior lines have sliced it into slivers. */
function coarseBody(image: RgbaImage, line: Uint8Array, width: number, height: number): FlatRegion | null {
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const inside = interiorMask(dilateMask(line, width, height, radius), width, height);
  let count = 0;
  for (const value of inside) if (value) count += 1;
  if (count < 40) return null;
  const eroded = erodeMask(inside, width, height, Math.min(radius, 3));
  const members: number[] = [];
  for (let index = 0; index < eroded.length; index += 1) if (eroded[index]) members.push(index);
  const colours = paintColours(image, members.length >= 12 ? members : indexList(inside));
  if (colours.length < 12) return null;
  const counts = new Map<string, number>();
  for (const rgb of colours) {
    const name = paletteName(rgb);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if ((ranked[1]?.[1] ?? 0) / colours.length >= 0.38) return null;
  const median = medianRgb(colours);
  const name = paletteName(median);
  if (name === 'putih') return null;
  const ids = new Int32Array(inside.length);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let index = 0; index < inside.length; index += 1) {
    if (!inside[index]) continue;
    ids[index] = 1;
    const x = index % width;
    const y = (index - x) / width;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const points = shapeOf(ids, 1, width, minX, minY, maxX, maxY, 0);
  if (!points || points.length < 4) return null;
  const spot = memberPoint(ids, 1, width);
  return { name, hex: snapKid(median), points, pixels: count, cx: spot.x, cy: spot.y };
}

function indexList(mask: Uint8Array): number[] {
  const members: number[] = [];
  for (let index = 0; index < mask.length; index += 1) if (mask[index]) members.push(index);
  return members;
}

function sampleRegion(image: RgbaImage, ids: Int32Array, id: number, width: number, height: number): { name: string; hex: string; mixed: boolean } | null {
  let members = erodedMembers(ids, id, width, height, 3);
  if (members.length < 12) members = erodedMembers(ids, id, width, height, 2);
  if (members.length < 12) members = erodedMembers(ids, id, width, height, 1);
  if (members.length < 8) {
    members = [];
    for (let index = 0; index < ids.length; index += 1) if (ids[index] === id) members.push(index);
  }
  const colours = paintColours(image, members);
  if (colours.length < 8) return null;
  const median = medianRgb(colours);
  const counts = new Map<string, number>();
  for (const rgb of colours) {
    const name = paletteName(rgb);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const second = ranked[1]?.[1] ?? 0;
  const name = paletteName(median);
  return { name, hex: name === 'putih' ? '#ffffff' : snapKid(median), mixed: second / colours.length >= 0.38 };
}

/** Prefer paint over the black line at the edge of a thin sliver. A truly black area still uses every pixel. */
function paintColours(image: RgbaImage, members: readonly number[]): Rgb[] {
  const all: Rgb[] = [];
  const paint: Rgb[] = [];
  for (const index of members) {
    const rgb = pixelAt(image.data, index);
    if (!rgb) continue;
    all.push(rgb);
    if (luminance(rgb) >= 36) paint.push(rgb);
  }
  return paint.length >= 8 ? paint : all;
}

function erodedMembers(ids: Int32Array, id: number, width: number, height: number, radius: number): number[] {
  const chosen: number[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index] !== id) continue;
    const x = index % width;
    const y = (index - x) / width;
    let inside = true;
    for (let dy = -radius; dy <= radius && inside; dy += 1) {
      const sy = y + dy;
      if (sy < 0 || sy >= height) {
        inside = false;
        break;
      }
      for (let dx = -radius; dx <= radius; dx += 1) {
        const sx = x + dx;
        if (sx < 0 || sx >= width || ids[sy * width + sx] !== id) inside = false;
      }
    }
    if (inside) chosen.push(index);
  }
  return chosen;
}

function medianRgb(colours: readonly Rgb[]): Rgb {
  const mid = (values: number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  return { r: mid(colours.map((colour) => colour.r)), g: mid(colours.map((colour) => colour.g)), b: mid(colours.map((colour) => colour.b)) };
}

/** Flat colour near the sample, not a stock swatch of a different brightness. */
function snapKid(rgb: Rgb): string {
  const quantize = (value: number) => Math.max(0, Math.min(255, Math.round(value / 16) * 16));
  const channel = (value: number) => quantize(value).toString(16).padStart(2, '0');
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function memberPoint(ids: Int32Array, id: number, width: number): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  let seen = 0;
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index] !== id) continue;
    sumX += index % width;
    sumY += (index - (index % width)) / width;
    seen += 1;
  }
  const ax = seen > 0 ? sumX / seen : 0;
  const ay = seen > 0 ? sumY / seen : 0;
  let bestX = ax;
  let bestY = ay;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ids.length; index += 1) {
    if (ids[index] !== id) continue;
    const x = index % width;
    const y = (index - x) / width;
    const dist = (x - ax) ** 2 + (y - ay) ** 2;
    if (dist < best) {
      best = dist;
      bestX = x;
      bestY = y;
    }
  }
  return { x: bestX, y: bestY };
}

function enclosedRegions(image: RgbaImage, barrier: Uint8Array): FlatRegion[] {
  const { width, height } = image;
  const exterior = new Uint8Array(barrier.length);
  const stack = new Int32Array(barrier.length);
  let top = 0;
  const push = (index: number) => {
    if (index < 0 || index >= barrier.length || exterior[index] || barrier[index]) return;
    exterior[index] = 1;
    stack[top] = index;
    top += 1;
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (top > 0) {
    top -= 1;
    const index = stack[top] ?? 0;
    const x = index % width;
    if (x > 0) push(index - 1);
    if (x + 1 < width) push(index + 1);
    if (index >= width) push(index - width);
    if (index + width < barrier.length) push(index + width);
  }
  const inside = new Uint8Array(barrier.length);
  for (let index = 0; index < inside.length; index += 1) {
    if (!barrier[index] && !exterior[index]) inside[index] = 1;
  }
  return componentsToRegions(image, inside);
}

function openRegions(image: RgbaImage): FlatRegion[] {
  const { width, height, data } = image;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    const rgb = pixelAt(data, index);
    if (!rgb || isPage(rgb)) continue;
    mask[index] = 1;
  }
  return componentsToRegions(image, mask, true);
}

function componentsToRegions(image: RgbaImage, mask: Uint8Array, skipFrame = false): FlatRegion[] {
  const { width, height } = image;
  const ids = new Int32Array(mask.length);
  const centreX0 = width * 0.28;
  const centreX1 = width * 0.72;
  const centreY0 = height * 0.28;
  const centreY1 = height * 0.72;
  const stats: Array<{
    id: number;
    pixels: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    name: string;
    border: boolean;
    centre: boolean;
  }> = [];
  let next = 0;
  const stack = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || ids[start]) continue;
    const rgb = pixelAt(image.data, start);
    if (!rgb) continue;
    const name = paletteName(rgb);
    next += 1;
    let top = 0;
    ids[start] = next;
    stack[top] = start;
    top += 1;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let border = false;
    let centre = false;
    while (top > 0) {
      top -= 1;
      const index = stack[top] ?? 0;
      pixels += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) border = true;
      if (x >= centreX0 && x <= centreX1 && y >= centreY0 && y <= centreY1) centre = true;
      const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || !mask[neighbor] || ids[neighbor]) continue;
        const other = pixelAt(image.data, neighbor);
        if (!other || paletteName(other) !== name) continue;
        ids[neighbor] = next;
        stack[top] = neighbor;
        top += 1;
      }
    }
    stats.push({ id: next, pixels, minX, minY, maxX, maxY, name, border, centre });
  }
  const minimum = Math.max(24, Math.round(width * height * 0.0004));
  const kept = stats
    .filter((stat) => stat.pixels >= minimum && !(skipFrame && stat.border && !stat.centre))
    .sort((left, right) => right.pixels - left.pixels)
    .slice(0, 12);
  const regions: FlatRegion[] = [];
  for (const stat of kept) {
    const points = shapeOf(ids, stat.id, width, stat.minX, stat.minY, stat.maxX, stat.maxY);
    if (!points || points.length < 4) continue;
    let sumX = 0;
    let sumY = 0;
    let seen = 0;
    for (let index = 0; index < ids.length; index += 1) {
      if (ids[index] !== stat.id) continue;
      sumX += index % width;
      sumY += (index - (index % width)) / width;
      seen += 1;
    }
    const ax = seen > 0 ? sumX / seen : (stat.minX + stat.maxX) / 2;
    const ay = seen > 0 ? sumY / seen : (stat.minY + stat.maxY) / 2;
    let repX = ax;
    let repY = ay;
    let repD = Number.POSITIVE_INFINITY;
    for (let index = 0; index < ids.length; index += 1) {
      if (ids[index] !== stat.id) continue;
      const x = index % width;
      const y = (index - x) / width;
      const dist = (x - ax) ** 2 + (y - ay) ** 2;
      if (dist < repD) {
        repD = dist;
        repX = x;
        repY = y;
      }
    }
    regions.push({
      name: stat.name,
      hex: stat.name === 'putih' ? '#ffffff' : paletteHex(stat.name),
      points,
      pixels: stat.pixels,
      cx: repX,
      cy: repY,
    });
  }
  return regions;
}

function shapeOf(
  ids: Int32Array,
  id: number,
  width: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  grow = 0,
): Point[] | null {
  const pad = 2;
  const cropW = maxX - minX + 1 + pad * 2;
  const cropH = maxY - minY + 1 + pad * 2;
  if (cropW < 4 || cropH < 4) return null;
  const data = new Uint8Array(cropW * cropH * 4);
  data.fill(255);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (ids[y * width + x] !== id) continue;
      const ox = x - minX + pad;
      const oy = y - minY + pad;
      const index = (oy * cropW + ox) * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  }
  if (grow > 0) growCrop(data, cropW, cropH, grow);
  const traced = traceInk({ width: cropW, height: cropH, data });
  const outer = traced.find((contour) => contour.silhouette) ?? traced[0];
  if (!outer || outer.points.length < 4) return null;
  return outer.points.map((point) => ({ x: point.x + minX - pad, y: point.y + minY - pad }));
}

function growCrop(data: Uint8Array, width: number, height: number, radius: number): void {
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    if ((data[index * 4] ?? 255) < 40) mask[index] = 1;
  }
  const grown = dilateMask(mask, width, height, radius);
  for (let index = 0; index < grown.length; index += 1) {
    if (!grown[index]) continue;
    const offset = index * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
    data[offset + 3] = 255;
  }
}

function hollowSolids(line: Uint8Array, width: number, height: number): void {
  const ids = new Int32Array(line.length);
  const stack = new Int32Array(line.length);
  let next = 0;
  const bulkyMin = Math.max(12, Math.min(width, height) * 0.12);
  for (let start = 0; start < line.length; start += 1) {
    if (!line[start] || ids[start]) continue;
    next += 1;
    let top = 0;
    ids[start] = next;
    stack[top] = start;
    top += 1;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      top -= 1;
      const index = stack[top] ?? 0;
      pixels += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || !line[neighbor] || ids[neighbor]) continue;
        ids[neighbor] = next;
        stack[top] = neighbor;
        top += 1;
      }
    }
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const bulky = Math.min(boxW, boxH) >= bulkyMin && pixels / Math.max(1, boxW * boxH) >= 0.55;
    if (!bulky) continue;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const index = y * width + x;
        if (ids[index] !== next || boundary(ids, next, x, y, width, height)) continue;
        line[index] = 0;
      }
    }
  }
}

function boundary(ids: Int32Array, id: number, x: number, y: number, width: number, height: number): boolean {
  const neighbors = [
    x > 0 ? ids[y * width + x - 1] : 0,
    x + 1 < width ? ids[y * width + x + 1] : 0,
    y > 0 ? ids[(y - 1) * width + x] : 0,
    y + 1 < height ? ids[(y + 1) * width + x] : 0,
  ];
  return neighbors.some((value) => value !== id);
}

function lineMask(image: RgbaImage): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  for (let index = 0; index < mask.length; index += 1) {
    const rgb = pixelAt(image.data, index);
    if (rgb && isLinePixel(rgb)) mask[index] = 1;
  }
  return mask;
}

function isLinePixel(rgb: Rgb): boolean {
  return luminance(rgb) < 52 && saturation(rgb) < 0.2;
}

function isPage(rgb: Rgb): boolean {
  return luminance(rgb) >= 242 && saturation(rgb) < 0.1;
}

function paintMask(mask: Uint8Array, width: number, height: number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  data.fill(255);
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    const offset = index * 4;
    data[offset] = 0;
    data[offset + 1] = 0;
    data[offset + 2] = 0;
  }
  return { width, height, data };
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sy >= 0 && sx < width && sy < height) out[sy * width + sx] = 1;
        }
      }
    }
  }
  return out;
}

function erodeMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = mask[y * width + x] === 1;
      for (let dy = -radius; dy <= radius && keep; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx < 0 || sy < 0 || sx >= width || sy >= height || !mask[sy * width + sx]) keep = false;
        }
      }
      if (keep) out[y * width + x] = 1;
    }
  }
  return out;
}

function pixelAt(data: Uint8Array, index: number): Rgb | null {
  const offset = index * 4;
  if ((data[offset + 3] ?? 255) < 128) return null;
  return { r: data[offset] ?? 0, g: data[offset + 1] ?? 0, b: data[offset + 2] ?? 0 };
}

function luminance(rgb: Rgb): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function saturation(rgb: Rgb): number {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  return max === 0 ? 0 : (max - min) / max;
}

function toLab(rgb: Rgb): { l: number; a: number; b: number } {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(rgb.r);
  const g = channel(rgb.g);
  const b = channel(rgb.b);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const pivot = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
