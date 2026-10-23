/**
 * Boxes, paths, contours, and the ink mask. The calculations are unchanged.
 */

import type { GuidePath } from '../../lesson-data/schema';
import type { DetectedPart } from '../parts';
import type { Contour, Point } from '../trace';
import { CONSTRUCTION_IOU_MIN, CONTAIN_MIN, ENCLOSE, LESSON_HEIGHT, LESSON_WIDTH, MASK_H, MASK_W, OUTLINE_COVERAGE_MIN, WIDE_PART } from './types';
import type { Box, LessonPiece, MappedContour } from './types';

export function outlineCoverage(contours: readonly Contour[]): number {
  const usable = contours.filter((contour) => contour.points.length >= 2);
  if (usable.length === 0) return 0;
  const boxes = usable.map((contour) => boxOf(contour.points));
  const subject = unionBox(boxes);
  const main = mainOf(usable);
  return boxOf(main.points).area / Math.max(1, subject.area);
}

export function shouldRedraw(coverage: number): boolean {
  return coverage < OUTLINE_COVERAGE_MIN;
}

/** Lesson-space box back into the source image, the inverse of the contour placement. */
export function imageRect(
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  sourceWidth: number,
  sourceHeight: number,
): { x: number; y: number; width: number; height: number } {
  const place = sourcePlacement(sourceWidth, sourceHeight);
  const scale = Math.max(1e-6, place.scale);
  return {
    x: (box.x - place.offsetX) / scale,
    y: (box.y - place.offsetY) / scale,
    width: box.width / scale,
    height: box.height / scale,
  };
}

/** Boxes for the same contours `buildPhotoLesson` numbers, so the model can name each piece. */
export function lessonPieces(
  contours: readonly Contour[],
  sourceWidth: number,
  sourceHeight: number,
): LessonPiece[] {
  return contours
    .map((contour) => mapContour(contour, sourceWidth, sourceHeight))
    .filter((contour) => contour.points.length >= 3)
    .map((contour, id) => {
      const box = boxOf(contour.points);
      return {
        id,
        x: round(box.minX),
        y: round(box.minY),
        width: round(Math.max(0, box.maxX - box.minX)),
        height: round(Math.max(0, box.maxY - box.minY)),
      };
    });
}

export function mapContours(contours: readonly Contour[], sourceWidth: number, sourceHeight: number): MappedContour[] {
  return contours
    .map((contour) => mapContour(contour, sourceWidth, sourceHeight))
    .filter((contour) => contour.points.length >= 3)
    .map((contour, id) => ({ ...contour, id }));
}

export function boxPrimitive(part: DetectedPart, id: string): GuidePath | null {
  if (part.shape === 'line') {
    const cy = part.y + part.height / 2;
    return {
      id,
      d: `M ${n(part.x)} ${n(cy)} L ${n(part.x + part.width)} ${n(cy)}`,
      role: 'final-outline',
    };
  }
  const shape = part.shape === 'dome'
    ? 'oval'
    : part.shape === 'circle' || part.shape === 'oval' || part.shape === 'triangle'
      ? part.shape
      : part.width / Math.max(1, part.height) > 1.35 || part.height / Math.max(1, part.width) > 1.35
        ? 'oval'
        : 'circle';
  const drawn = renderGuide({ ...part, shape }, id)[0];
  if (!drawn) return null;
  return { ...drawn, id, role: 'final-outline' };
}

export function renderGuide(part: DetectedPart, id: string): GuidePath[] {
  const cx = part.x + part.width / 2;
  const cy = part.y + part.height / 2;
  if (part.shape === 'circle' || part.shape === 'oval' || part.shape === 'dome') {
    const rx = Math.max(8, part.width / 2);
    const ry = part.shape === 'circle' ? Math.max(8, Math.min(part.width, part.height) / 2) : Math.max(8, part.height / 2);
    const d = part.shape === 'dome'
      ? `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(cx + rx)} ${n(cy)} Z`
      : ellipsePath(cx, cy, rx, ry);
    return [{ id: `${id}-1`, d, role: 'construction' }];
  }
  if (part.shape === 'triangle') {
    const d = `M ${n(cx)} ${n(part.y)} L ${n(part.x + part.width)} ${n(part.y + part.height)} L ${n(part.x)} ${n(part.y + part.height)} Z`;
    return [{ id: `${id}-1`, d, role: 'construction' }];
  }
  if (part.shape === 'line') {
    return [
      { id: `${id}-h`, d: `M ${n(part.x)} ${n(cy)} L ${n(part.x + part.width)} ${n(cy)}`, role: 'construction' },
      { id: `${id}-v`, d: `M ${n(cx)} ${n(part.y)} L ${n(cx)} ${n(part.y + part.height)}`, role: 'construction' },
    ];
  }
  return [];
}

export function polygonShare(inner: readonly Point[], outer: readonly Point[]): number {
  const samples = insideSamples(inner);
  if (samples.length === 0) return 0;
  let hits = 0;
  for (const point of samples) if (pointInPolygon(point.x, point.y, outer)) hits += 1;
  return hits / samples.length;
}

export function centroidOf(points: readonly Point[]): Point {
  const samples = insideSamples(points);
  const pool = samples.length > 0 ? samples : [...points];
  const sum = pool.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  const count = Math.max(1, pool.length);
  return { x: sum.x / count, y: sum.y / count };
}

export function insideSamples(points: readonly Point[]): Point[] {
  const box = boxOf(points);
  const cols = 8;
  const rows = 8;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const samples: Point[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const point = { x: box.minX + ((x + 0.5) / cols) * width, y: box.minY + ((y + 0.5) / rows) * height };
      if (pointInPolygon(point.x, point.y, points)) samples.push(point);
    }
  }
  return samples.length > 0 ? samples : [...points];
}

export function fillSamples(points: readonly Point[]): number {
  const box = boxOf(points);
  const cols = 36;
  const rows = 27;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  let inside = 0;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = box.minX + ((x + 0.5) / cols) * width;
      const py = box.minY + ((y + 0.5) / rows) * height;
      if (pointInPolygon(px, py, points)) inside += 1;
    }
  }
  return inside;
}

export function ownInk(contours: readonly MappedContour[]): number {
  const mask = new Uint8Array(MASK_W * MASK_H);
  stampContours(mask, contours);
  let count = 0;
  for (const value of mask) if (value) count += 1;
  return count;
}

export function freshInk(existing: Uint8Array, contours: readonly MappedContour[]): number {
  const covered = dilateMask(existing);
  const scratch = covered.slice();
  stampContours(scratch, contours);
  let fresh = 0;
  for (let index = 0; index < scratch.length; index += 1) {
    if (scratch[index] && !covered[index]) fresh += 1;
  }
  return fresh;
}

export function dilateMask(mask: Uint8Array): Uint8Array {
  const out = mask.slice();
  for (let y = 0; y < MASK_H; y += 1) {
    for (let x = 0; x < MASK_W; x += 1) {
      if (!mask[y * MASK_W + x]) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const sx = x + dx;
          const sy = y + dy;
          if (sx >= 0 && sy >= 0 && sx < MASK_W && sy < MASK_H) out[sy * MASK_W + sx] = 1;
        }
      }
    }
  }
  return out;
}

export function stampContours(mask: Uint8Array, contours: readonly MappedContour[]): void {
  for (const contour of contours) {
    const points = samplePath(contour.path);
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      if (start && end) stampSegment(mask, start, end);
    }
  }
}

/** The shipped path, sampled the way the contact sheet draws it. */
export function samplePath(d: string): Point[] {
  const tokens = d.match(/[a-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const points: Point[] = [];
  let index = 0;
  let start: Point | null = null;
  let cursor = { x: 0, y: 0 };
  const take = (offset: number) => Number(tokens[index + offset] ?? '0');
  while (index < tokens.length) {
    const token = tokens[index] ?? '';
    if (!/^[a-z]$/i.test(token)) {
      index += 1;
      continue;
    }
    const command = token.toUpperCase();
    if (command === 'Z') {
      if (start) points.push(start);
      if (start) cursor = start;
      index += 1;
      continue;
    }
    if (command === 'M' || command === 'L') {
      cursor = { x: take(1), y: take(2) };
      if (command === 'M') start = cursor;
      points.push(cursor);
      index += 3;
      continue;
    }
    if (command === 'H') {
      cursor = { x: take(1), y: cursor.y };
      points.push(cursor);
      index += 2;
      continue;
    }
    if (command === 'V') {
      cursor = { x: cursor.x, y: take(1) };
      points.push(cursor);
      index += 2;
      continue;
    }
    if (command === 'C') {
      const c1 = { x: take(1), y: take(2) };
      const c2 = { x: take(3), y: take(4) };
      const end = { x: take(5), y: take(6) };
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        const mt = 1 - t;
        points.push({
          x: mt * mt * mt * cursor.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * end.x,
          y: mt * mt * mt * cursor.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * end.y,
        });
      }
      cursor = end;
      index += 7;
      continue;
    }
    if (command === 'A') {
      const end = { x: take(6), y: take(7) };
      points.push(end);
      cursor = end;
      index += 8;
      continue;
    }
    index += 1;
  }
  return points;
}

export function stampSegment(mask: Uint8Array, start: Point, end: Point): void {
  const from = maskPoint(start);
  const to = maskPoint(end);
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    if (x >= 0 && y >= 0 && x < MASK_W && y < MASK_H) mask[y * MASK_W + x] = 1;
    if (x === to.x && y === to.y) break;
    const doubled = err * 2;
    if (doubled > -dy) {
      err -= dy;
      x += sx;
    }
    if (doubled < dx) {
      err += dx;
      y += sy;
    }
  }
}

export function maskPoint(point: Point): { x: number; y: number } {
  return {
    x: Math.round((point.x * (MASK_W - 1)) / LESSON_WIDTH),
    y: Math.round((point.y * (MASK_H - 1)) / LESSON_HEIGHT),
  };
}

export function guidesFor(id: string, contours: readonly MappedContour[]): GuidePath[] {
  return contours.map((contour, index) => ({
    id: `${id}-${index + 1}`,
    d: contour.path,
    role: 'final-outline' as const,
  }));
}

export function outlineOwner(contour: MappedContour, parts: readonly DetectedPart[]): DetectedPart | null {
  const listed = parts.filter((part) => part.pieceIds.includes(contour.id));
  if (listed.length > 0) return listed.reduce((best, part) => (areaOf(part) > areaOf(best) ? part : best));
  let best: DetectedPart | null = null;
  let bestArea = -1;
  for (const part of parts) {
    if (containment(contour, part) < CONTAIN_MIN) continue;
    const area = areaOf(part);
    if (area > bestArea) {
      best = part;
      bestArea = area;
    }
  }
  return best;
}

/** Smallest part that contains the ink. Wide boxes are skipped for interior lines. */
export function enclosingPart(
  contour: MappedContour,
  parts: readonly DetectedPart[],
  subject: Box,
  skipWide: boolean,
): DetectedPart | null {
  let best: DetectedPart | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    const fraction = partFraction(part, subject);
    if (fraction > 0.97) continue;
    if (skipWide && fraction > WIDE_PART) continue;
    if (containment(contour, part) < ENCLOSE) continue;
    const area = areaOf(part);
    if (area < bestArea) {
      best = part;
      bestArea = area;
    }
  }
  return best;
}

export function closeContour(points: readonly Point[], id: number): MappedContour | null {
  const unique = dedupePoints(points);
  if (unique.length < 4) return null;
  const ring = [...unique];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first.x !== last.x || first.y !== last.y)) ring.push(first);
  return {
    points: ring,
    closed: true,
    area: Math.abs(shoelace(ring)),
    length: polylineLength(ring),
    cx: ring.reduce((sum, point) => sum + point.x, 0) / ring.length,
    cy: ring.reduce((sum, point) => sum + point.y, 0) / ring.length,
    nx: 0,
    ny: 0,
    silhouette: false,
    path: smoothPath(ring, true),
    id,
  };
}

export function isSeparateObject(contour: MappedContour, main: MappedContour): boolean {
  if (!contour.closed) return false;
  const area = boxOf(contour.points).area;
  const mainArea = Math.max(1, boxOf(main.points).area);
  if (area < mainArea * 0.18 || area > mainArea * 0.92) return false;
  let total = 0;
  let seen = 0;
  const step = Math.max(1, Math.floor(contour.points.length / 16));
  for (let index = 0; index < contour.points.length; index += step) {
    const point = contour.points[index];
    if (!point) continue;
    total += nearest(point, main.points);
    seen += 1;
  }
  return seen > 0 && total / seen > 18;
}

export function nearest(point: Point, line: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    if (!start || !end) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length2 = dx * dx + dy * dy;
    const t = length2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / length2));
    const gap = Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
    if (gap < best) best = gap;
  }
  return best;
}

export function partFraction(part: DetectedPart, subject: Box): number {
  return areaOf(part) / Math.max(1, subject.area);
}

export function containsPoint(part: DetectedPart, point: Point): boolean {
  const polygon = part.points.length >= 3 ? part.points : rectPoints(part);
  return pointInPolygon(point.x, point.y, polygon);
}

export function sourcePlacement(sourceWidth: number, sourceHeight: number): { scale: number; offsetX: number; offsetY: number } {
  const pad = 48;
  const scale = Math.min((LESSON_WIDTH - pad * 2) / Math.max(1, sourceWidth), (LESSON_HEIGHT - pad * 2) / Math.max(1, sourceHeight));
  return {
    scale,
    offsetX: (LESSON_WIDTH - sourceWidth * scale) / 2,
    offsetY: (LESSON_HEIGHT - sourceHeight * scale) / 2,
  };
}

export function containment(contour: MappedContour, part: DetectedPart): number {
  const polygon = part.points.length >= 3 ? part.points : rectPoints(part);
  let inside = 0;
  for (const point of contour.points) {
    if (pointInPolygon(point.x, point.y, polygon)) inside += 1;
  }
  return inside / Math.max(1, contour.points.length);
}

export function rectPoints(part: DetectedPart): Point[] {
  return [
    { x: part.x, y: part.y },
    { x: part.x + part.width, y: part.y },
    { x: part.x + part.width, y: part.y + part.height },
    { x: part.x, y: part.y + part.height },
  ];
}

export function areaOf(part: DetectedPart): number {
  return Math.max(0, part.width) * Math.max(0, part.height);
}

export function uniqueContours(contours: readonly MappedContour[]): MappedContour[] {
  const kept: MappedContour[] = [];
  for (const contour of contours) {
    if (!kept.includes(contour)) kept.push(contour);
  }
  return kept;
}

export function pickMain(contours: readonly MappedContour[]): MappedContour {
  const silhouette = contours.find((contour) => contour.silhouette && contour.closed);
  if (silhouette) return silhouette;
  return mainOf(contours);
}

export function mainOf<T extends { readonly points: readonly Point[]; readonly closed: boolean }>(contours: readonly T[]): T {
  const closed = contours.filter((contour) => contour.closed && contour.points.length >= 3);
  const pool = closed.length > 0 ? closed : contours;
  return pool.reduce((best, contour) => (boxOf(contour.points).area > boxOf(best.points).area ? contour : best));
}

export function constructionOf(points: readonly Point[]): { kind: 'circle' | 'ellipse'; d: string } | null {
  const box = boxOf(points);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  if (width < 12 || height < 12) return null;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const ellipseScore = filledIou(points, box, false);
  const circleScore = filledIou(points, box, true);
  if (circleScore >= ellipseScore && circleScore >= CONSTRUCTION_IOU_MIN) {
    const radius = Math.min(width, height) / 2;
    return { kind: 'circle', d: ellipsePath(cx, cy, radius, radius) };
  }
  if (ellipseScore >= CONSTRUCTION_IOU_MIN && (width / height > 1.15 || height / width > 1.15)) {
    return { kind: 'ellipse', d: ellipsePath(cx, cy, width / 2, height / 2) };
  }
  if (ellipseScore >= CONSTRUCTION_IOU_MIN && circleScore >= CONSTRUCTION_IOU_MIN) {
    const radius = (width + height) / 4;
    return { kind: 'circle', d: ellipsePath(cx, cy, radius, radius) };
  }
  return null;
}

export function filledIou(points: readonly Point[], box: Box, circle: boolean): number {
  const size = 36;
  const width = Math.max(1, box.maxX - box.minX);
  const height = Math.max(1, box.maxY - box.minY);
  const rx = circle ? Math.min(width, height) / 2 : width / 2;
  const ry = circle ? rx : height / 2;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = box.minX + ((x + 0.5) / size) * width;
      const py = box.minY + ((y + 0.5) / size) * height;
      const inPoly = pointInPolygon(px, py, points);
      const inPrim = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
      if (inPoly || inPrim) union += 1;
      if (inPoly && inPrim) intersection += 1;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const leftX = cx - rx;
  const rightX = cx + rx;
  return `M ${n(leftX)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 1 ${n(rightX)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 1 ${n(leftX)} ${n(cy)} Z`;
}

export function smoothPath(points: readonly Point[], closed: boolean): string {
  const ring = closed ? openRing(points) : dedupePoints(points);
  if (ring.length === 0) return 'M 0 0';
  const first = ring[0] ?? { x: 0, y: 0 };
  if (ring.length === 1) return `M ${n(first.x)} ${n(first.y)}`;
  const simplified = rdp(ring, Math.max(3, diagonal(ring) * 0.012));
  const used = simplified.length >= 2 ? simplified : ring;
  if (used.length <= 8 && mostlyCorners(used)) return polyline(used, closed);
  return curves(used, closed);
}

export function curves(points: readonly Point[], closed: boolean): string {
  const count = points.length;
  const at = (index: number): Point => points[(index + count) % count] ?? points[0] ?? { x: 0, y: 0 };
  const start = points[0] ?? { x: 0, y: 0 };
  const commands = [`M ${n(start.x)} ${n(start.y)}`];
  const last = closed ? count : count - 1;
  for (let index = 0; index < last; index += 1) {
    const p0 = closed ? at(index - 1) : (points[Math.max(0, index - 1)] ?? start);
    const p1 = closed ? at(index) : (points[index] ?? start);
    const p2 = closed ? at(index + 1) : (points[Math.min(count - 1, index + 1)] ?? p1);
    const p3 = closed ? at(index + 2) : (points[Math.min(count - 1, index + 2)] ?? p2);
    if (!closed && index >= count - 1) break;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    commands.push(`C ${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2.x)} ${n(p2.y)}`);
  }
  if (closed) commands.push('Z');
  return commands.join(' ');
}

export function polyline(points: readonly Point[], closed: boolean): string {
  const head = points[0] ?? { x: 0, y: 0 };
  const commands = [`M ${n(head.x)} ${n(head.y)}`];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    commands.push(`L ${n(point.x)} ${n(point.y)}`);
  }
  if (closed) commands.push('Z');
  return commands.join(' ');
}

export function mostlyCorners(points: readonly Point[]): boolean {
  if (points.length < 3) return true;
  let sharp = 0;
  for (let index = 0; index < points.length; index += 1) {
    const prev = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!prev || !current || !next) continue;
    if (turn(prev, current, next) < 2.2) sharp += 1;
  }
  return sharp >= points.length - 1;
}

export function turn(prev: Point, current: Point, next: Point): number {
  const ax = prev.x - current.x;
  const ay = prev.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const denom = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (denom < 1e-6) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / denom)));
}

export function rdp(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return [...points];
  let farthest = 1;
  let distance = -1;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (!point) continue;
    const gap = pointLineDistance(point, first, last);
    if (gap > distance) {
      distance = gap;
      farthest = index;
    }
  }
  if (distance > epsilon) {
    const point = points[farthest];
    const left = rdp(points.slice(0, farthest + 1), epsilon);
    const right = point ? rdp(points.slice(farthest), epsilon) : [];
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

export function pointLineDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

export function diagonal(points: readonly Point[]): number {
  const box = boxOf(points);
  return Math.hypot(box.maxX - box.minX, box.maxY - box.minY);
}

export function openRing(points: readonly Point[]): Point[] {
  const cleaned = dedupePoints(points);
  if (cleaned.length < 2) return cleaned;
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) < 1.5) return cleaned.slice(0, -1);
  return cleaned;
}

export function dedupePoints(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.5) continue;
    out.push(point);
  }
  return out;
}

export function mapContour(contour: Contour, sourceWidth: number, sourceHeight: number): MappedContour {
  const place = sourcePlacement(sourceWidth, sourceHeight);
  const points = contour.points.map((point) => ({
    x: round(place.offsetX + point.x * place.scale),
    y: round(place.offsetY + point.y * place.scale),
  }));
  const source = contour.points;
  const sx = source.reduce((sum, point) => sum + point.x, 0) / Math.max(1, source.length);
  const sy = source.reduce((sum, point) => sum + point.y, 0) / Math.max(1, source.length);
  return {
    points,
    closed: contour.closed,
    area: Math.abs(shoelace(points)),
    length: polylineLength(points),
    cx: points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length),
    cy: points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, points.length),
    nx: sourceWidth <= 1 ? 0 : sx / (sourceWidth - 1),
    ny: sourceHeight <= 1 ? 0 : sy / (sourceHeight - 1),
    silhouette: contour.silhouette === true,
    path: smoothPath(points, contour.closed),
    id: 0,
  };
}

export function boxOf(points: readonly Point[]): Box {
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
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, area: 0 };
  return { minX, minY, maxX, maxY, area: Math.max(0, maxX - minX) * Math.max(0, maxY - minY) };
}

export function unionBox(boxes: readonly Box[]): Box {
  const seed = boxes[0] ?? { minX: 0, minY: 0, maxX: 0, maxY: 0, area: 0 };
  const merged = boxes.reduce((box, next) => ({
    minX: Math.min(box.minX, next.minX),
    minY: Math.min(box.minY, next.minY),
    maxX: Math.max(box.maxX, next.maxX),
    maxY: Math.max(box.maxY, next.maxY),
    area: 0,
  }), seed);
  return { ...merged, area: Math.max(0, merged.maxX - merged.minX) * Math.max(0, merged.maxY - merged.minY) };
}

export function isSpeck(shape: MappedContour, mainBox: Box): boolean {
  const box = boxOf(shape.points);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const mainSpan = Math.max(1, Math.max(mainBox.maxX - mainBox.minX, mainBox.maxY - mainBox.minY));
  if (span < 18 && box.area < 250) return true;
  return span < mainSpan * 0.04 && box.area < mainBox.area * 0.005;
}

export function dedupe(shapes: readonly MappedContour[]): MappedContour[] {
  const kept: MappedContour[] = [];
  for (const shape of shapes) {
    const box = boxOf(shape.points);
    const duplicate = kept.some((other) => {
      const ratio = shape.length / Math.max(1, other.length);
      const otherBox = boxOf(other.points);
      const width = Math.max(0, Math.min(box.maxX, otherBox.maxX) - Math.max(box.minX, otherBox.minX));
      const height = Math.max(0, Math.min(box.maxY, otherBox.maxY) - Math.max(box.minY, otherBox.minY));
      const intersection = width * height;
      const union = box.area + otherBox.area - intersection;
      const overlap = union <= 0 ? 0 : intersection / union;
      return overlap >= 0.82 && ratio > 0.75 && ratio < 1.34;
    });
    if (!duplicate) kept.push(shape);
  }
  return kept;
}

export function pointInPolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    const intersect = ((a.y > y) !== (b.y > y)) && (x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-9) + a.x);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function shoelace(points: readonly Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (!current || !next) continue;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

export function polylineLength(points: readonly Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }
  return length;
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}
