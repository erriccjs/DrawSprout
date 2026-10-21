/**
 * Line-art to closed and open outlines.
 *
 * Marching squares on a black-and-white mask, then Ramer–Douglas–Peucker.
 * The result is polylines, not a full Potrace curve fit. Curves are not
 * required: the lesson path subset allows straight segments, and one
 * TypeScript file runs in the Worker, the browser, and the eval script
 * without a WASM build. See D-66.
 */

import type { RgbaImage } from './png';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Contour {
  readonly points: readonly Point[];
  readonly closed: boolean;
  /** Outer boundary of the filled subject. Step 1 uses this contour. */
  readonly silhouette?: boolean;
}

const INK_LUMINANCE = 170;
const MAX_POINTS = 64;

export function traceInk(image: RgbaImage, threshold = INK_LUMINANCE): Contour[] {
  const { width, height } = image;
  const ink = inkMask(image, threshold);
  if (ink.every((value) => value === 0)) return [];
  const erased = eraseStripeRuns(ink, width, height);
  const cleaned = cleanInk(erased, width, height);
  const epsilon = Math.max(1.25, Math.min(width, height) * 0.004);
  const filled = filledSubject(cleaned, width, height);
  const detailMask = shouldThin(cleaned, width, height) ? thinStrokes(cleaned, width, height) : cleaned;
  const details = collapseNested(contoursFrom(detailMask, width, height, epsilon, filled)
    .filter((contour) => !bothSidesShorterThan(contour.points, Math.max(4, Math.min(width, height) * 0.02))));
  const outerLoop = largestLoop(marchingSquares(filled, width, height));
  if (!outerLoop) return dedupeContours(mergeNearParallel(details, width, height));
  const outer = finishLoop(outerLoop, epsilon, null, width, height);
  if (outer.length < 4) return dedupeContours(mergeNearParallel(details, width, height));
  const silhouette: Contour = { points: outer, closed: true, silhouette: true };
  return dedupeContours(mergeNearParallel([
    silhouette,
    ...details.filter((contour) => iouBoxes(bounds(contour.points), bounds(outer)) < 0.82),
  ], width, height));
}

/** Two strokes of one line. A shorter copy close to a kept line is dropped. The silhouette stays. */
function mergeNearParallel(contours: readonly Contour[], width: number, height: number): Contour[] {
  const gap = Math.max(3, Math.min(width, height) * 0.035);
  const silhouette = contours.find((contour) => contour.silhouette === true);
  const rest = contours
    .filter((contour) => contour !== silhouette)
    .sort((left, right) => polylineLength(right.points) - polylineLength(left.points));
  const kept: Contour[] = silhouette ? [silhouette] : [];
  for (const contour of rest) {
    const duplicate = kept.some((other) => nearParallel(contour, other, gap));
    if (!duplicate) kept.push(contour);
  }
  return kept;
}

function nearParallel(left: Contour, right: Contour, gap: number): boolean {
  const ratio = polylineLength(left.points) / Math.max(1, polylineLength(right.points));
  if (ratio < 0.55 || ratio > 1.8) return false;
  return meanGap(left.points, right.points) <= gap && meanGap(right.points, left.points) <= gap;
}

function meanGap(from: readonly Point[], to: readonly Point[]): number {
  const samples = samplePoints(from, 20);
  if (samples.length === 0 || to.length < 2) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (const point of samples) total += nearestSegment(point, to);
  return total / samples.length;
}

function nearestSegment(point: Point, line: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    if (!start || !end) continue;
    const gap = pointSegmentDistance(point, start, end);
    if (gap < best) best = gap;
  }
  return best;
}

function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length2 = dx * dx + dy * dy;
  if (length2 < 1e-6) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length2));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function samplePoints(points: readonly Point[], count: number): Point[] {
  if (points.length === 0) return [];
  if (points.length <= count) return [...points];
  const out: Point[] = [];
  for (let step = 0; step < count; step += 1) {
    const index = Math.min(points.length - 1, Math.round((step / (count - 1)) * (points.length - 1)));
    const point = points[index];
    if (point) out.push(point);
  }
  return out;
}

function polylineLength(points: readonly Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return length;
}

function bothSidesShorterThan(points: readonly Point[], minSpan: number): boolean {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return maxX - minX < minSpan && maxY - minY < minSpan;
}

function marchingSquares(mask: Uint8Array, width: number, height: number): Point[][] {
  const gridW = width + 2;
  const gridH = height + 2;
  const grid = new Uint8Array(gridW * gridH);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) grid[(y + 1) * gridW + (x + 1)] = 1;
    }
  }
  const segments: Array<{ a: Point; b: Point }> = [];
  for (let y = 0; y < gridH - 1; y += 1) {
    for (let x = 0; x < gridW - 1; x += 1) {
      const nw = grid[y * gridW + x] ?? 0;
      const ne = grid[y * gridW + x + 1] ?? 0;
      const se = grid[(y + 1) * gridW + x + 1] ?? 0;
      const sw = grid[(y + 1) * gridW + x] ?? 0;
      const index = (nw << 3) | (ne << 2) | (se << 1) | sw;
      const crossings: Point[] = [];
      if ((nw !== 0) !== (ne !== 0)) crossings.push({ x: x + 0.5, y });
      if ((ne !== 0) !== (se !== 0)) crossings.push({ x: x + 1, y: y + 0.5 });
      if ((sw !== 0) !== (se !== 0)) crossings.push({ x: x + 0.5, y: y + 1 });
      if ((nw !== 0) !== (sw !== 0)) crossings.push({ x, y: y + 0.5 });
      if (crossings.length === 2) {
        const first = crossings[0];
        const second = crossings[1];
        if (first && second) segments.push({ a: first, b: second });
      } else if (crossings.length === 4 && index !== 5 && index !== 10) {
        const top = crossings[0];
        const right = crossings[1];
        const bottom = crossings[2];
        const left = crossings[3];
        if (top && right && bottom && left) {
          segments.push({ a: top, b: right }, { a: bottom, b: left });
        }
      } else if (crossings.length === 4) {
        const top = crossings[0];
        const right = crossings[1];
        const bottom = crossings[2];
        const left = crossings[3];
        if (top && right && bottom && left) {
          segments.push({ a: top, b: left }, { a: right, b: bottom });
        }
      }
    }
  }
  return stitch(segments).map((loop) => loop.map((point) => ({ x: point.x - 1, y: point.y - 1 })));
}

function stitch(segments: Array<{ a: Point; b: Point }>): Point[][] {
  const unused = new Set(segments.map((_, index) => index));
  const byPoint = new Map<string, number[]>();
  const add = (point: Point, index: number) => {
    const key = pointKey(point);
    const list = byPoint.get(key) ?? [];
    list.push(index);
    byPoint.set(key, list);
  };
  segments.forEach((segment, index) => {
    add(segment.a, index);
    add(segment.b, index);
  });
  const loops: Point[][] = [];
  for (const start of unused) {
    if (!unused.has(start)) continue;
    const first = segments[start];
    if (!first) continue;
    unused.delete(start);
    const loop = [first.a];
    let current = first.b;
    let guard = 0;
    while (guard < segments.length + 2) {
      guard += 1;
      loop.push(current);
      if (samePoint(current, loop[0]!) && loop.length > 3) break;
      const next = (byPoint.get(pointKey(current)) ?? []).find((index) => unused.has(index));
      if (next === undefined) break;
      const segment = segments[next];
      if (!segment) break;
      unused.delete(next);
      current = samePoint(segment.a, current) ? segment.b : segment.a;
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

function simplify(points: readonly Point[], epsilon: number): Point[] {
  if (points.length <= 4) return [...points];
  const closed = samePoint(points[0]!, points[points.length - 1]!);
  const open = closed ? points.slice(0, -1) : [...points];
  const kept = rdp(open, epsilon);
  if (closed) {
    const first = kept[0];
    if (first) kept.push(first);
  }
  return kept.length >= 4 ? kept : [...points.slice(0, 4), ...(closed && points[0] ? [points[0]] : [])];
}

function rdp(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let farthest = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicular(points[i]!, first, last);
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  if (farthest > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

function perpendicular(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

function pointKey(point: Point): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

function samePoint(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) < 0.01 && Math.abs(left.y - right.y) < 0.01;
}

function inkMask(image: RgbaImage, threshold: number): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; i < mask.length; i += 1, p += 4) {
    const lum = 0.2126 * (image.data[p] ?? 255) + 0.7152 * (image.data[p + 1] ?? 255) + 0.0722 * (image.data[p + 2] ?? 255);
    if ((image.data[p + 3] ?? 255) > 16 && lum < threshold) mask[i] = 1;
  }
  return mask;
}

function cleanInk(mask: Uint8Array, width: number, height: number): Uint8Array {
  const labeled = label(mask, width, height);
  if (labeled.count === 0) return mask;
  const largest = labeled.stats.reduce((best, stat) => (stat.pixels > best.pixels ? stat : best), labeled.stats[0]!);
  const largestSpan = Math.max(largest.maxX - largest.minX, largest.maxY - largest.minY);
  const largestBox = Math.max(1, (largest.maxX - largest.minX + 1) * (largest.maxY - largest.minY + 1));
  const drop = new Set<number>();
  for (const stat of labeled.stats) {
    if (stat.id === largest.id) continue;
    const spanX = stat.maxX - stat.minX;
    const spanY = stat.maxY - stat.minY;
    const span = Math.max(spanX, spanY);
    const box = (spanX + 1) * (spanY + 1);
    const fill = stat.pixels / box;
    const tiny = stat.pixels < Math.max(8, largest.pixels * 0.004) && span < largestSpan * 0.12;
    const blob = fill > 0.55 && box < largestBox * 0.05;
    if (tiny || blob) drop.add(stat.id);
  }
  for (const id of stripeClusters(labeled, width, height, largestSpan)) drop.add(id);
  if (drop.size === 0) return mask;
  const out = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    const id = labeled.ids[index] ?? 0;
    if (id !== 0 && !drop.has(id)) out[index] = 1;
  }
  return out;
}

interface CompStat {
  readonly id: number;
  pixels: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sumX: number;
  sumY: number;
}

function stripeClusters(
  labeled: { ids: Int32Array; stats: CompStat[] },
  width: number,
  height: number,
  largestSpan: number,
): number[] {
  const maxGap = Math.max(4, Math.min(width, height) * 0.012);
  const stripes = labeled.stats.filter((stat) => {
    const spanX = stat.maxX - stat.minX;
    const spanY = stat.maxY - stat.minY;
    const length = Math.max(spanX, spanY);
    const thickness = Math.max(1, Math.min(spanX, spanY));
    return length >= thickness * 3 && thickness <= maxGap && length < largestSpan * 0.55;
  });
  const used = new Set<number>();
  const drop: number[] = [];
  for (const seed of stripes) {
    if (used.has(seed.id)) continue;
    const horizontal = (seed.maxX - seed.minX) >= (seed.maxY - seed.minY);
    const group = stripes.filter((other) => {
      const otherHorizontal = (other.maxX - other.minX) >= (other.maxY - other.minY);
      if (otherHorizontal !== horizontal) return false;
      const gap = horizontal
        ? Math.abs((seed.sumY / seed.pixels) - (other.sumY / other.pixels))
        : Math.abs((seed.sumX / seed.pixels) - (other.sumX / other.pixels));
      const overlap = horizontal
        ? Math.min(seed.maxX, other.maxX) - Math.max(seed.minX, other.minX)
        : Math.min(seed.maxY, other.maxY) - Math.max(seed.minY, other.minY);
      const shorter = Math.min(
        horizontal ? seed.maxX - seed.minX : seed.maxY - seed.minY,
        horizontal ? other.maxX - other.minX : other.maxY - other.minY,
      );
      return gap <= maxGap && overlap > shorter * 0.5;
    });
    if (group.length >= 3) {
      for (const stat of group) {
        used.add(stat.id);
        drop.push(stat.id);
      }
    }
  }
  return drop;
}

function label(mask: Uint8Array, width: number, height: number): { ids: Int32Array; count: number; stats: CompStat[] } {
  const ids = new Int32Array(mask.length);
  const stats: CompStat[] = [];
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || ids[start]) continue;
    count += 1;
    const stat: CompStat = { id: count, pixels: 0, minX: width, minY: height, maxX: 0, maxY: 0, sumX: 0, sumY: 0 };
    stack.push(start);
    ids[start] = count;
    while (stack.length > 0) {
      const index = stack.pop();
      if (index === undefined) break;
      const x = index % width;
      const y = (index - x) / width;
      stat.pixels += 1;
      stat.sumX += x;
      stat.sumY += y;
      if (x < stat.minX) stat.minX = x;
      if (y < stat.minY) stat.minY = y;
      if (x > stat.maxX) stat.maxX = x;
      if (y > stat.maxY) stat.maxY = y;
      if (x > 0) push(index - 1);
      if (x + 1 < width) push(index + 1);
      if (y > 0) push(index - width);
      if (y + 1 < height) push(index + width);
    }
    stats.push(stat);
  }
  return { ids, count, stats };

  function push(index: number): void {
    if (mask[index] && !ids[index]) {
      ids[index] = count;
      stack.push(index);
    }
  }
}

/**
 * Short parallel bars (a barcode) are erased before components are labelled,
 * including bars that touch the main drawing. A gap of one to four pixels
 * separates bars; adjacent pixels of one thick stroke are left alone.
 */
function eraseStripeRuns(mask: Uint8Array, width: number, height: number): Uint8Array {
  const maxLen = Math.max(2, Math.round(Math.max(width, height) * 0.28));
  const out = mask.slice();
  clearParallelRuns(out, width, height, maxLen, true);
  clearParallelRuns(out, width, height, maxLen, false);
  return out;
}

function clearParallelRuns(
  mask: Uint8Array,
  width: number,
  height: number,
  maxLen: number,
  horizontal: boolean,
): void {
  const rows = horizontal ? height : width;
  const cols = horizontal ? width : height;
  const runs: Array<{ fixed: number; a: number; b: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    let col = 0;
    while (col < cols) {
      const index = horizontal ? row * width + col : col * width + row;
      if (!mask[index]) {
        col += 1;
        continue;
      }
      const start = col;
      while (col < cols) {
        const next = horizontal ? row * width + col : col * width + row;
        if (!mask[next]) break;
        col += 1;
      }
      const length = col - start;
      if (length >= 2 && length <= maxLen) runs.push({ fixed: row, a: start, b: col - 1 });
    }
  }
  if (runs.length < 3) return;
  const parent = runs.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) {
      const next = parent[cursor] ?? cursor;
      parent[cursor] = parent[next] ?? next;
      cursor = parent[cursor] ?? cursor;
    }
    return cursor;
  };
  const unite = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[a] = b;
  };
  const at = new Map<number, number[]>();
  runs.forEach((run, index) => {
    const list = at.get(run.fixed) ?? [];
    list.push(index);
    at.set(run.fixed, list);
  });
  for (const [fixed, indexes] of at) {
    for (let delta = 2; delta <= 5; delta += 1) {
      const others = at.get(fixed + delta);
      if (!others) continue;
      for (const left of indexes) {
        const run = runs[left];
        if (!run) continue;
        for (const right of others) {
          const other = runs[right];
          if (!other) continue;
          const overlapStart = Math.max(run.a, other.a);
          const overlapEnd = Math.min(run.b, other.b);
          const overlap = overlapEnd - overlapStart + 1;
          const shorter = Math.min(run.b - run.a, other.b - other.a) + 1;
          if (overlap <= shorter * 0.5) continue;
          if (!whiteGap(mask, width, horizontal, run.fixed, other.fixed, overlapStart, overlapEnd)) continue;
          unite(left, right);
        }
      }
    }
  }
  const groups = new Map<number, number[]>();
  runs.forEach((_, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(index);
    groups.set(root, list);
  });
  for (const indexes of groups.values()) {
    if (indexes.length < 3) continue;
    for (const index of indexes) {
      const run = runs[index];
      if (!run) continue;
      for (let col = run.a; col <= run.b; col += 1) {
        const pixel = horizontal ? run.fixed * width + col : col * width + run.fixed;
        mask[pixel] = 0;
      }
    }
  }
}

/** A solid filled blob stays filled. Stroke-like ink is thinned to a midline. */
function whiteGap(
  mask: Uint8Array,
  width: number,
  horizontal: boolean,
  from: number,
  to: number,
  start: number,
  end: number,
): boolean {
  const first = Math.min(from, to) + 1;
  const last = Math.max(from, to);
  if (first >= last) return false;
  for (let line = first; line < last; line += 1) {
    for (let col = start; col <= end; col += 1) {
      const index = horizontal ? line * width + col : col * width + line;
      if (mask[index]) return false;
    }
  }
  return true;
}

function shouldThin(mask: Uint8Array, width: number, height: number): boolean {
  let pixels = 0;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      pixels += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (pixels < 16) return false;
  const box = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
  return pixels / box < 0.62;
}

/** Centre line of a thick stroke. A solid fill is not passed here. */
function thinStrokes(mask: Uint8Array, width: number, height: number): Uint8Array {
  const ridge = medialAxis(mask, width, height);
  let pixels = 0;
  for (const value of ridge) if (value) pixels += 1;
  if (pixels < 16) return mask;
  return dilate(ridge, width, height, 1);
}

function medialAxis(mask: Uint8Array, width: number, height: number): Uint8Array {
  const dist = new Int16Array(mask.length);
  const queue = new Int32Array(mask.length);
  let tail = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      let edge = x === 0 || y === 0 || x + 1 === width || y + 1 === height;
      if (!edge) {
        for (let dy = -1; dy <= 1 && !edge; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            if (!mask[index + dy * width + dx]) edge = true;
          }
        }
      }
      if (!edge) continue;
      dist[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  }
  let head = 0;
  while (head < tail) {
    const index = queue[head] ?? 0;
    head += 1;
    const next = (dist[index] ?? 0) + 1;
    const x = index % width;
    const y = (index - x) / width;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (!mask[neighbor] || dist[neighbor]) continue;
        dist[neighbor] = next;
        queue[tail] = neighbor;
        tail += 1;
      }
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const here = dist[index] ?? 0;
      if (here < 2) continue;
      let peak = true;
      for (let dy = -1; dy <= 1 && peak; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          if ((dist[index + dy * width + dx] ?? 0) > here) peak = false;
        }
      }
      if (peak) out[index] = 1;
    }
  }
  return out;
}

function collapseNested(contours: Contour[]): Contour[] {
  const sorted = [...contours].sort((left, right) => bounds(right.points).area - bounds(left.points).area);
  const kept: Contour[] = [];
  for (const contour of sorted) {
    const box = bounds(contour.points);
    const nested = kept.some((other) => iouBoxes(box, bounds(other.points)) >= 0.7);
    if (!nested) kept.push(contour);
  }
  return kept;
}

function filledSubject(mask: Uint8Array, width: number, height: number): Uint8Array {
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const dilated = dilate(mask, width, height, radius);
  const outside = new Uint8Array(mask.length);
  const stack: number[] = [];
  const push = (index: number) => {
    if (index < 0 || index >= mask.length || outside[index] || dilated[index]) return;
    outside[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const index = stack.pop();
    if (index === undefined) break;
    const x = index % width;
    if (x > 0) push(index - 1);
    if (x + 1 < width) push(index + 1);
    if (index >= width) push(index - width);
    if (index + width < mask.length) push(index + width);
  }
  const filled = new Uint8Array(mask.length);
  for (let index = 0; index < filled.length; index += 1) {
    if (!outside[index]) filled[index] = 1;
  }
  const labeled = label(filled, width, height);
  if (labeled.count === 0) return filled;
  const largest = labeled.stats.reduce((best, stat) => (stat.pixels > best.pixels ? stat : best), labeled.stats[0]!);
  const out = new Uint8Array(mask.length);
  for (let index = 0; index < out.length; index += 1) {
    if (labeled.ids[index] === largest.id) out[index] = 1;
  }
  return out;
}

function dilate(mask: Uint8Array, width: number, _height: number, radius: number): Uint8Array {
  const dist = new Int16Array(mask.length);
  dist.fill(radius + 1);
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) {
      dist[index] = 0;
      queue[tail] = index;
      tail += 1;
    }
  }
  while (head < tail) {
    const index = queue[head] ?? 0;
    head += 1;
    const distance = dist[index] ?? 0;
    if (distance >= radius) continue;
    const x = index % width;
    const next = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, index >= width ? index - width : -1, index + width < mask.length ? index + width : -1];
    for (const neighbor of next) {
      if (neighbor < 0) continue;
      if ((dist[neighbor] ?? radius + 1) > distance + 1) {
        dist[neighbor] = distance + 1;
        queue[tail] = neighbor;
        tail += 1;
      }
    }
  }
  const out = new Uint8Array(mask.length);
  for (let index = 0; index < out.length; index += 1) {
    if ((dist[index] ?? radius + 1) <= radius) out[index] = 1;
  }
  return out;
}

function contoursFrom(mask: Uint8Array, width: number, height: number, epsilon: number, filled: Uint8Array): Contour[] {
  return marchingSquares(mask, width, height)
    .map((loop) => {
      const points = dropChords(finishLoop(loop, epsilon, null, width, height), filled, width, height);
      const closed = points.length > 3 && samePoint(points[0]!, points[points.length - 1]!);
      return { points, closed };
    })
    .filter((contour) => contour.points.length >= 4);
}

function largestLoop(loops: Point[][]): Point[] | null {
  let best: Point[] | null = null;
  let bestArea = -1;
  for (const loop of loops) {
    const box = bounds(loop);
    const area = box.width * box.height;
    if (area > bestArea) {
      best = loop;
      bestArea = area;
    }
  }
  return best;
}

function finishLoop(points: readonly Point[], epsilon: number, filled: Uint8Array | null, width: number, height: number): Point[] {
  let simplified = simplify(points, epsilon);
  let nextEpsilon = epsilon;
  while (simplified.length > MAX_POINTS && nextEpsilon < 48) {
    nextEpsilon *= 1.45;
    simplified = simplify(points, nextEpsilon);
  }
  if (simplified.length > MAX_POINTS) simplified = resampleClosed(points, MAX_POINTS - 1);
  return filled ? dropChords(simplified, filled, width, height) : simplified;
}

function resampleClosed(points: readonly Point[], count: number): Point[] {
  const open = points.length > 1 && samePoint(points[0]!, points[points.length - 1]!) ? points.slice(0, -1) : [...points];
  const first = open[0];
  if (!first || open.length < 3) return [...points];
  if (open.length <= count) return [...open, first];
  const cumulative = [0];
  for (let index = 1; index < open.length; index += 1) {
    cumulative.push((cumulative[index - 1] ?? 0) + Math.hypot(open[index]!.x - open[index - 1]!.x, open[index]!.y - open[index - 1]!.y));
  }
  const total = (cumulative[cumulative.length - 1] ?? 0) + Math.hypot(first.x - open[open.length - 1]!.x, first.y - open[open.length - 1]!.y);
  const out: Point[] = [];
  for (let step = 0; step < count; step += 1) {
    const target = (total * step) / count;
    let index = 1;
    while (index < cumulative.length && (cumulative[index] ?? 0) < target) index += 1;
    const end = open[index] ?? first;
    const start = open[index - 1] ?? first;
    const span = (cumulative[index] ?? total) - (cumulative[index - 1] ?? 0);
    const t = span <= 0 ? 0 : (target - (cumulative[index - 1] ?? 0)) / span;
    out.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  const head = out[0];
  if (head) out.push(head);
  return out;
}

function dropChords(points: Point[], filled: Uint8Array, width: number, height: number): Point[] {
  if (points.length < 4) return points;
  const box = bounds(points);
  const diagonal = Math.hypot(box.width, box.height);
  const kept: Point[] = [points[0]!];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!;
    const to = points[index]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length > diagonal * 0.28 && deepInside(filled, width, height, (from.x + to.x) / 2, (from.y + to.y) / 2)) continue;
    kept.push(to);
  }
  return kept.length >= 4 ? kept : points;
}

function deepInside(filled: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const sx = cx + dx;
      const sy = cy + dy;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height || !filled[sy * width + sx]) return false;
    }
  }
  return true;
}

function dedupeContours(contours: Contour[]): Contour[] {
  const kept: Contour[] = [];
  for (const contour of contours) {
    const box = bounds(contour.points);
    const duplicate = kept.some((other) => iouBoxes(box, bounds(other.points)) >= 0.82);
    if (!duplicate) kept.push(contour);
  }
  return kept;
}

function bounds(points: readonly Point[]): { minX: number; minY: number; width: number; height: number; area: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  return { minX, minY, width, height, area: width * height };
}

function iouBoxes(
  left: { minX: number; minY: number; width: number; height: number; area: number },
  right: { minX: number; minY: number; width: number; height: number; area: number },
): number {
  const width = Math.max(0, Math.min(left.minX + left.width, right.minX + right.width) - Math.max(left.minX, right.minX));
  const height = Math.max(0, Math.min(left.minY + left.height, right.minY + right.height) - Math.max(left.minY, right.minY));
  const intersection = width * height;
  const union = left.area + right.area - intersection;
  return union <= 0 ? 0 : intersection / union;
}
