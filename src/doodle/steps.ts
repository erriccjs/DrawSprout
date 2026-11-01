/**
 * Turns a line doodle and the original photo into a short lesson.
 *
 * Step 1 is the convex silhouette, not every line at once. The line drawing
 * is thinned and split at junctions, then nearby strokes are grouped into a
 * few parts. The last steps are a few bright colours taken from the subject,
 * not from the white page or the grey shadows.
 */

import { packageLesson } from '../categories/author';
import { ellipse } from '../categories/shapes';
import type { GuidePath, LessonPackage, LessonStep } from '../lesson-data/schema';
import type { RgbaImage } from '../photo/png';

const SPACE_W = 1000;
const SPACE_H = 750;
const INK = 128;
const MAX_PARTS = 5;

export function buildDoodleLesson(doodle: RgbaImage, photo: RgbaImage): LessonPackage {
  const scaled = downscaleMask(inkMask(doodle), doodle.width, doodle.height, 280);
  const { ink, width, height } = scaled;
  const count = ink.reduce((sum, bit) => sum + bit, 0);
  if (count < 40) throw new Error('Doodle-nya terlalu kosong.');
  const bounds = boundsOf(ink, width, height);
  const hull = convexHull(sampleInk(ink, width, bounds));
  if (hull.length < 3) throw new Error('Doodle-nya terlalu kosong.');

  const parts = groupStrokes(ink, width, height, bounds);
  const colours = subjectColours(width, height, photo, ink, hull);

  const shape = pathFrom(hull.map((point) => toSpace(point, bounds)), true);
  const guides: GuidePath[] = [{ id: 'shape', d: shape, role: 'final-outline' }];
  const steps: LessonStep[] = [
    outlineStep('shape', 'Gambar bentuk besarnya.', 'Mulai dari bentuk yang paling besar.', guides),
  ];
  parts.forEach((part, index) => {
    const guidePaths: GuidePath[] = [];
    part.forEach((chain, chainIndex) => {
      const d = pathFrom(chain.map((point) => toSpace(point, bounds)), false);
      if (d.length < 8) return;
      guidePaths.push({
        id: `part-${index + 1}-${chainIndex + 1}`,
        d,
        role: 'final-outline',
      });
    });
    if (guidePaths.length === 0) return;
    steps.push(outlineStep(
      `part-${index + 1}`,
      index === 0 ? 'Gambar bagian ini.' : 'Gambar bagian yang lebih kecil.',
      index === 0 ? 'Bagian yang besar.' : 'Bagian yang lebih kecil.',
      guidePaths,
    ));
  });

  const regions = colours.map((colour, index) => ({
    id: `colour-${index + 1}`,
    label: 'Warna',
    d: index === 0 ? shape : `${ellipse(colour.x, colour.y, colour.rx, colour.ry)} Z`,
    suggestedColor: colour.hex,
  }));
  regions.forEach((region, index) => {
    steps.push({
      id: `color-${index + 1}`,
      phase: 'color' as const,
      instruction: index === 0 ? 'Warnai warna yang paling besar.' : 'Warnai warna ini.',
      hint: 'Warna yang cerah, dari bendanya.',
      guidePaths: [],
      colorRegionIds: [region.id],
      toolPreset: { tool: 'brush' as const, color: region.suggestedColor, widthViewbox: index === 0 ? 48 : 28 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
  });

  return packageLesson({
    id: `doodle-${inkHash(ink)}`,
    title: 'Doodle dari foto',
    subtitle: 'Dari doodle',
    contentVersion: 'doodle-1',
    colorRegions: regions,
    steps,
  });
}

function outlineStep(id: string, instruction: string, hint: string, guidePaths: readonly GuidePath[]) {
  return {
    id,
    phase: 'outline' as const,
    instruction,
    hint,
    guidePaths,
    colorRegionIds: [],
    toolPreset: { tool: 'pen' as const, color: '#3a3a3a', widthViewbox: 8 },
    completionPolicy: { manualAllowed: true, automaticEnabled: false },
  };
}

function inkMask(image: RgbaImage): Uint8Array {
  const ink = new Uint8Array(image.width * image.height);
  const { data } = image;
  for (let i = 0; i < ink.length; i += 1) {
    const offset = i * 4;
    const r = data[offset] ?? 255;
    const g = data[offset + 1] ?? 255;
    const b = data[offset + 2] ?? 255;
    const luma = (r * 30 + g * 59 + b * 11) / 100;
    ink[i] = luma < INK ? 1 : 0;
  }
  return dropSpecks(ink, image.width, image.height, 24);
}

function dropSpecks(ink: Uint8Array, width: number, height: number, min: number): Uint8Array {
  const seen = new Uint8Array(ink.length);
  const out = new Uint8Array(ink.length);
  const stack: number[] = [];
  for (let start = 0; start < ink.length; start += 1) {
    if (ink[start] !== 1 || seen[start]) continue;
    stack.push(start);
    seen[start] = 1;
    const pixels: number[] = [];
    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      pixels.push(index);
      const x = index % width;
      const y = (index - x) / width;
      for (const [nx, ny] of neighbours(x, y, width, height)) {
        const next = ny * width + nx;
        if (ink[next] === 1 && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    if (pixels.length >= min) {
      for (const index of pixels) out[index] = 1;
    }
  }
  return out;
}

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

function boundsOf(ink: Uint8Array, width: number, height: number): Bounds {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (ink[y * width + x] !== 1) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function sampleInk(ink: Uint8Array, width: number, bounds: Bounds): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const step = Math.max(1, Math.floor(Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 80));
  for (let y = bounds.minY; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      if (ink[y * width + x] === 1) points.push([x, y]);
    }
  }
  return points;
}

function convexHull(points: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter((point, index) => index === 0 || point[0] !== sorted[index - 1]?.[0] || point[1] !== sorted[index - 1]?.[1]);
  if (unique.length < 3) return unique;
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Array<[number, number]> = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: Array<[number, number]> = [];
  for (let index = unique.length - 1; index >= 0; index -= 1) {
    const point = unique[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function downscaleMask(
  ink: Uint8Array,
  width: number,
  height: number,
  maxEdge: number,
): { ink: Uint8Array; width: number; height: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { ink, width, height };
  const nextWidth = Math.max(1, Math.round(width * maxEdge / edge));
  const nextHeight = Math.max(1, Math.round(height * maxEdge / edge));
  const out = new Uint8Array(nextWidth * nextHeight);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (ink[y * width + x] !== 1) continue;
      const nx = Math.min(nextWidth - 1, Math.floor(x * nextWidth / width));
      const ny = Math.min(nextHeight - 1, Math.floor(y * nextHeight / height));
      out[ny * nextWidth + nx] = 1;
    }
  }
  return { ink: out, width: nextWidth, height: nextHeight };
}

function groupStrokes(
  ink: Uint8Array,
  width: number,
  height: number,
  bounds: Bounds,
): Array<Array<Array<[number, number]>>> {
  const chains = strokeChains(ink, width, height);
  const spans = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  const anchors: Array<{ chains: Array<Array<[number, number]>>; weight: number; cx: number; cy: number }> = [];
  const ordered = [...chains].sort((a, b) => b.length - a.length);
  for (const chain of ordered) {
    const center = chainCentroid(chain);
    const near = anchors.find((anchor) => Math.hypot(anchor.cx - center.x, anchor.cy - center.y) < spans * 0.22);
    if (near) {
      near.chains.push(chain);
      near.weight += chain.length;
      const next = chainsCentroid(near.chains);
      near.cx = next.x;
      near.cy = next.y;
    } else if (anchors.length < MAX_PARTS) {
      anchors.push({ chains: [chain], weight: chain.length, cx: center.x, cy: center.y });
    } else {
      const host = anchors.reduce((best, anchor) => {
        const bestDist = Math.hypot(best.cx - center.x, best.cy - center.y);
        const dist = Math.hypot(anchor.cx - center.x, anchor.cy - center.y);
        return dist < bestDist ? anchor : best;
      });
      host.chains.push(chain);
      host.weight += chain.length;
    }
  }
  return anchors
    .sort((a, b) => b.weight - a.weight)
    .map((anchor) => anchor.chains);
}

/** Thin the ink, cut it at junctions, and keep each piece as its own stroke. */
function strokeChains(ink: Uint8Array, width: number, height: number): Array<Array<[number, number]>> {
  const skeleton = breakJunctions(thin(ink, width, height), width, height);
  const segments = componentsOf(skeleton, width, height).filter((pixels) => pixels.length >= 6);
  const chosen = segments.length >= 2
    ? segments
    : componentsOf(ink, width, height).filter((pixels) => pixels.length >= 12);
  return chosen
    .map((pixels) => traceComponent(pixels, width, height))
    .filter((chain) => chain.length >= 2);
}

function chainCentroid(chain: readonly [number, number][]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of chain) {
    sx += x;
    sy += y;
  }
  return { x: sx / chain.length, y: sy / chain.length };
}

function chainsCentroid(chains: readonly (readonly [number, number][])[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let count = 0;
  for (const chain of chains) {
    for (const [x, y] of chain) {
      sx += x;
      sy += y;
      count += 1;
    }
  }
  return { x: sx / count, y: sy / count };
}

/** Zhang-Suen thinning. The copy is 1 for ink and 0 for paper. */
function thin(ink: Uint8Array, width: number, height: number): Uint8Array {
  const image = ink.slice();
  const remove: number[] = [];
  for (let pass = 0; pass < 48; pass += 1) {
    let changed = false;
    for (const sub of [0, 1]) {
      remove.length = 0;
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          if (image[index] !== 1) continue;
          const n = ring(image, x, y, width);
          const neighbours = n.reduce((sum, bit) => sum + bit, 0);
          if (neighbours < 2 || neighbours > 6) continue;
          if (transitions(n) !== 1) continue;
          const p2 = n[0] ?? 0;
          const p4 = n[2] ?? 0;
          const p6 = n[4] ?? 0;
          const p8 = n[6] ?? 0;
          if (sub === 0) {
            if (p2 * p4 * p6 !== 0) continue;
            if (p4 * p6 * p8 !== 0) continue;
          } else {
            if (p2 * p4 * p8 !== 0) continue;
            if (p2 * p6 * p8 !== 0) continue;
          }
          remove.push(index);
        }
      }
      if (remove.length > 0) changed = true;
      for (const index of remove) image[index] = 0;
    }
    if (!changed) break;
  }
  return image;
}

function ring(image: Uint8Array, x: number, y: number, width: number): number[] {
  const at = (dx: number, dy: number) => image[(y + dy) * width + (x + dx)] === 1 ? 1 : 0;
  return [at(0, -1), at(1, -1), at(1, 0), at(1, 1), at(0, 1), at(-1, 1), at(-1, 0), at(-1, -1)];
}

function transitions(neighbours: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < neighbours.length; i += 1) {
    if (neighbours[i] === 0 && neighbours[(i + 1) % neighbours.length] === 1) count += 1;
  }
  return count;
}

function breakJunctions(skeleton: Uint8Array, width: number, height: number): Uint8Array {
  const out = skeleton.slice();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (skeleton[index] !== 1) continue;
      // A bend in a single line has two transitions. A real branch has three.
      if (transitions(ring(skeleton, x, y, width)) >= 3) out[index] = 0;
    }
  }
  return out;
}

function componentsOf(ink: Uint8Array, width: number, height: number): number[][] {
  const seen = new Uint8Array(ink.length);
  const found: number[][] = [];
  const stack: number[] = [];
  for (let start = 0; start < ink.length; start += 1) {
    if (ink[start] !== 1 || seen[start]) continue;
    stack.push(start);
    seen[start] = 1;
    const pixels: number[] = [];
    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      pixels.push(index);
      const x = index % width;
      const y = (index - x) / width;
      for (const [nx, ny] of neighbours(x, y, width, height)) {
        const next = ny * width + nx;
        if (ink[next] === 1 && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    found.push(pixels);
  }
  return found;
}

function traceComponent(pixels: readonly number[], width: number, height: number): Array<[number, number]> {
  const set = new Set(pixels);
  let start = pixels[0] ?? 0;
  for (const index of pixels) if (index < start) start = index;
  const path: Array<[number, number]> = [];
  let current = start;
  let guard = 0;
  const seen = new Set<number>();
  while (guard < pixels.length && !seen.has(current)) {
    seen.add(current);
    const x = current % width;
    const y = (current - x) / width;
    path.push([x, y]);
    let next = -1;
    for (const [nx, ny] of neighbours(x, y, width, height)) {
      const index = ny * width + nx;
      if (set.has(index) && !seen.has(index)) {
        next = index;
        break;
      }
    }
    if (next < 0) break;
    current = next;
    guard += 1;
  }
  return simplify(path, 2.2);
}

function simplify(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length < 4) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() ?? [0, 0];
    let far = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = pointLine(points[i]!, points[start]!, points[end]!);
      if (distance > far) {
        far = distance;
        index = i;
      }
    }
    if (index >= 0 && far > epsilon) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function pointLine(point: [number, number], start: [number, number], end: [number, number]): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy) || 1;
  return Math.abs((point[0] - start[0]) * dy - (point[1] - start[1]) * dx) / length;
}

interface SubjectColour {
  readonly hex: string;
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
}

function subjectColours(
  width: number,
  height: number,
  photo: RgbaImage,
  ink: Uint8Array,
  hull: Array<[number, number]>,
): SubjectColour[] {
  const samples: Array<{ r: number; g: number; b: number; x: number; y: number }> = [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 80));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (ink[y * width + x] === 1) continue;
      if (!inside(x, y, hull)) continue;
      const colour = pixel(photo, x / width, y / height);
      if (!colour || isPage(colour)) continue;
      samples.push({ ...colour, x, y });
    }
  }
  const corners = cornerColours(photo);
  const interior = samples.filter((sample) => !nearCorner(sample, corners));
  const pool = interior.length >= 12 ? interior : samples;
  const usable = pool.filter((sample) => saturation(sample) >= 0.18);
  const chosen = (usable.length >= 12 ? usable : pool).slice(0, 4000);
  if (chosen.length === 0) {
    return [{ hex: '#f0c43a', x: 500, y: 375, rx: 80, ry: 60 }];
  }
  const clustered = kMeans(chosen, Math.min(4, Math.max(1, Math.floor(chosen.length / 30))));
  const total = clustered.reduce((sum, center) => sum + center.n, 0) || 1;
  const centers = distinctColours(clustered.filter((center, index) => index === 0 || center.n >= total * 0.12));
  const bounds = boundsOf(ink, width, height);
  return centers.slice(0, 4).map((center, index) => {
    const at = toSpace([center.x, center.y], bounds);
    return {
      hex: kidHex(center),
      x: index === 0 ? 500 : at.x,
      y: index === 0 ? 375 : at.y,
      rx: index === 0 ? 80 : 46,
      ry: index === 0 ? 60 : 36,
    };
  });
}

function cornerColours(photo: RgbaImage): Array<{ r: number; g: number; b: number }> {
  return [[0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.96, 0.96]]
    .map(([u, v]) => pixel(photo, u ?? 0, v ?? 0))
    .filter((colour): colour is { r: number; g: number; b: number } => colour !== null);
}

function nearCorner(
  colour: { r: number; g: number; b: number },
  corners: ReadonlyArray<{ r: number; g: number; b: number }>,
): boolean {
  return corners.some((corner) => (
    (corner.r - colour.r) ** 2 + (corner.g - colour.g) ** 2 + (corner.b - colour.b) ** 2 < 35 * 35
  ));
}

function isPage(colour: { r: number; g: number; b: number }): boolean {
  const luma = (colour.r * 30 + colour.g * 59 + colour.b * 11) / 100;
  return luma > 235 || (saturation(colour) < 0.08 && luma > 170);
}

function saturation(colour: { r: number; g: number; b: number }): number {
  const max = Math.max(colour.r, colour.g, colour.b);
  const min = Math.min(colour.r, colour.g, colour.b);
  return max === 0 ? 0 : (max - min) / max;
}

function kidHex(colour: { r: number; g: number; b: number }): string {
  const bright: Array<[number, number, number]> = [
    [226, 59, 59],
    [240, 145, 60],
    [240, 196, 58],
    [62, 154, 85],
    [61, 116, 214],
    [138, 90, 50],
    [242, 166, 179],
    [247, 244, 238],
    [58, 58, 58],
  ];
  const sat = saturation(colour);
  const luma = (colour.r * 30 + colour.g * 59 + colour.b * 11) / 100;
  if (sat >= 0.28 && luma >= 50 && luma <= 230) {
    const boosted = {
      r: clamp(colour.r + (colour.r - luma) * 0.25),
      g: clamp(colour.g + (colour.g - luma) * 0.25),
      b: clamp(colour.b + (colour.b - luma) * 0.25),
    };
    return hex(boosted.r, boosted.g, boosted.b);
  }
  let best = bright[4]!;
  let gap = Number.POSITIVE_INFINITY;
  for (const candidate of bright) {
    const distance = (candidate[0] - colour.r) ** 2 + (candidate[1] - colour.g) ** 2 + (candidate[2] - colour.b) ** 2;
    if (distance < gap) {
      gap = distance;
      best = candidate;
    }
  }
  return hex(best[0], best[1], best[2]);
}

function distinctColours(
  centers: Array<{ r: number; g: number; b: number; x: number; y: number; n: number }>,
): Array<{ r: number; g: number; b: number; x: number; y: number; n: number }> {
  const kept: typeof centers = [];
  for (const center of centers) {
    const similar = kept.find((other) => (
      (other.r - center.r) ** 2 + (other.g - center.g) ** 2 + (other.b - center.b) ** 2 < 45 * 45
    ));
    if (!similar) kept.push(center);
  }
  return kept;
}

function kMeans(
  samples: Array<{ r: number; g: number; b: number; x: number; y: number }>,
  k: number,
): Array<{ r: number; g: number; b: number; x: number; y: number; n: number }> {
  const centers = samples.filter((_, index) => index % Math.max(1, Math.floor(samples.length / k)) === 0).slice(0, k);
  let groups = centers.map(() => [] as typeof samples);
  for (let pass = 0; pass < 6; pass += 1) {
    groups = centers.map(() => [] as typeof samples);
    for (const sample of samples) {
      let best = 0;
      let gap = Number.POSITIVE_INFINITY;
      centers.forEach((center, index) => {
        const distance = (center.r - sample.r) ** 2 + (center.g - sample.g) ** 2 + (center.b - sample.b) ** 2;
        if (distance < gap) {
          gap = distance;
          best = index;
        }
      });
      groups[best]?.push(sample);
    }
    groups.forEach((group, index) => {
      if (group.length === 0) return;
      const mean = group.reduce((sum, sample) => ({
        r: sum.r + sample.r,
        g: sum.g + sample.g,
        b: sum.b + sample.b,
        x: sum.x + sample.x,
        y: sum.y + sample.y,
      }), { r: 0, g: 0, b: 0, x: 0, y: 0 });
      centers[index] = {
        r: mean.r / group.length,
        g: mean.g / group.length,
        b: mean.b / group.length,
        x: mean.x / group.length,
        y: mean.y / group.length,
      };
    });
  }
  return centers
    .map((center, index) => ({ ...center, n: groups[index]?.length ?? 0 }))
    .filter((center) => center.n > 0)
    .sort((a, b) => b.n - a.n);
}

function inside(x: number, y: number, hull: Array<[number, number]>): boolean {
  let crossed = false;
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i, i += 1) {
    const a = hull[i]!;
    const b = hull[j]!;
    const intersect = ((a[1] > y) !== (b[1] > y))
      && (x < ((b[0] - a[0]) * (y - a[1])) / ((b[1] - a[1]) || 1) + a[0]);
    if (intersect) crossed = !crossed;
  }
  return crossed;
}

function pixel(image: RgbaImage, u: number, v: number): { r: number; g: number; b: number } | null {
  const x = Math.min(image.width - 1, Math.max(0, Math.floor(u * image.width)));
  const y = Math.min(image.height - 1, Math.max(0, Math.floor(v * image.height)));
  const offset = (y * image.width + x) * 4;
  return {
    r: image.data[offset] ?? 0,
    g: image.data[offset + 1] ?? 0,
    b: image.data[offset + 2] ?? 0,
  };
}

function toSpace(point: [number, number], bounds: Bounds): { x: number; y: number } {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((SPACE_W - 80) / width, (SPACE_H - 80) / height);
  const drawnW = width * scale;
  const drawnH = height * scale;
  const ox = (SPACE_W - drawnW) / 2;
  const oy = (SPACE_H - drawnH) / 2;
  return {
    x: Math.round(ox + (point[0] - bounds.minX) * scale),
    y: Math.round(oy + (point[1] - bounds.minY) * scale),
  };
}

function pathFrom(points: Array<{ x: number; y: number }>, close: boolean): string {
  if (points.length === 0) return '';
  const body = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  return close ? `${body} Z` : body;
}

function neighbours(x: number, y: number, width: number, height: number): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) found.push([nx, ny]);
    }
  }
  return found;
}

function inkHash(ink: Uint8Array): string {
  let hash = 2166136261;
  for (let i = 0; i < ink.length; i += 17) {
    hash ^= ink[i] ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function hex(r: number, g: number, b: number): string {
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function byte(value: number): string {
  return clamp(value).toString(16).padStart(2, '0');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
