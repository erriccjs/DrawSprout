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
}

const INK_LUMINANCE = 170;

export function traceInk(image: RgbaImage, threshold = INK_LUMINANCE): Contour[] {
  const mask = new Uint8Array(image.width * image.height);
  for (let i = 0, p = 0; i < mask.length; i += 1, p += 4) {
    const r = image.data[p] ?? 255;
    const g = image.data[p + 1] ?? 255;
    const b = image.data[p + 2] ?? 255;
    const a = image.data[p + 3] ?? 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (a > 16 && lum < threshold) mask[i] = 1;
  }
  const loops = marchingSquares(mask, image.width, image.height);
  const epsilon = Math.max(1.25, Math.min(image.width, image.height) * 0.004);
  return loops
    .map((points) => ({ points: simplify(points, epsilon).slice(0, 80), closed: true }))
    .filter((contour) => contour.points.length >= 4);
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
