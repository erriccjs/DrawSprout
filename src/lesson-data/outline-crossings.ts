/**
 * Final ink should meet, not pass through another final line.
 *
 * A junction is allowed: one stroke ends on another. A crossing is not: the
 * intersection sits in the middle of both strokes. Construction lines may
 * cross, but their samples have to sit inside a colour fill.
 */

import type { LessonPackage } from './schema';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface OutlineIssue {
  readonly lessonId: string;
  readonly kind: 'crossing' | 'uncovered-helper';
  readonly detail: string;
}

const JUNCTION = 12;
const SAMPLE = 10;

export function auditLesson(lesson: LessonPackage): OutlineIssue[] {
    const finals = lesson.steps.flatMap((step) =>
    step.guidePaths.filter((path) => path.role === 'final-outline').flatMap((path) =>
      flattenContours(path.d).map((points, index) => ({
        id: index === 0 ? path.id : `${path.id}#${index}`,
        points,
      })),
    ),
  );
  const issues: OutlineIssue[] = [];
  for (let i = 0; i < finals.length; i += 1) {
    for (let j = i + 1; j < finals.length; j += 1) {
      const hits = crossingsBetween(finals[i]!.points, finals[j]!.points);
      for (const hit of hits) {
        issues.push({
          lessonId: lesson.id,
          kind: 'crossing',
          detail: `${finals[i]!.id} × ${finals[j]!.id} @ ${Math.round(hit.x)},${Math.round(hit.y)}`,
        });
      }
    }
  }

  const fills = lesson.colorRegions.map((region) => flattenContours(region.d).flat());
  for (const step of lesson.steps) {
    for (const path of step.guidePaths) {
      if (path.role !== 'construction') continue;
      const samples = flattenContours(path.d).flat();
      const outside = samples.filter((point) => !fills.some((fill) => covered(point, fill)));
      if (samples.length > 0 && outside.length / samples.length > 0.2) {
        issues.push({
          lessonId: lesson.id,
          kind: 'uncovered-helper',
          detail: path.id,
        });
      }
    }
  }
  return issues;
}

export function crossingsBetween(a: readonly Point[], b: readonly Point[]): Point[] {
  const hits: Point[] = [];
  for (let i = 0; i < a.length - 1; i += 1) {
    for (let j = 0; j < b.length - 1; j += 1) {
      const hit = segmentCross(a[i]!, a[i + 1]!, b[j]!, b[j + 1]!);
      if (!hit) continue;
      const endsA = nearEnd(hit, a[i]!, a[i + 1]!);
      const endsB = nearEnd(hit, b[j]!, b[j + 1]!);
      if (endsA || endsB) continue;
      if (hits.some((other) => distance(other, hit) < JUNCTION)) continue;
      hits.push(hit);
    }
  }
  return hits;
}

/** Drop a short stub that continues past another stroke, so the line ends on it. */
export function trimOvershoots(chains: readonly (readonly Point[])[]): Point[][] {
  const next = chains.map((chain) => chain.map((point) => ({ ...point })));
  for (let i = 0; i < next.length; i += 1) {
    for (let j = 0; j < next.length; j += 1) {
      if (i === j) continue;
      next[i] = cutStub(next[i]!, next[j]!);
    }
  }
  return next.filter((chain) => chain.length >= 2);
}

function cutStub(chain: Point[], other: readonly Point[]): Point[] {
  let cut = chain;
  for (let guard = 0; guard < 4; guard += 1) {
    const hits = crossingsBetween(cut, other);
    if (hits.length === 0) return cut;
    const hit = hits[0]!;
    let nearest = 0;
    let best = Infinity;
    cut.forEach((point, index) => {
      const gap = distance(point, hit);
      if (gap < best) {
        best = gap;
        nearest = index;
      }
    });
    const head = nearest;
    const tail = cut.length - 1 - nearest;
    if (head <= 2 && head < tail) cut = [hit, ...cut.slice(nearest)];
    else if (tail <= 2 && tail < head) cut = [...cut.slice(0, nearest + 1), hit];
    else return cut;
  }
  return cut;
}

export function cleanLessonOutlines(lesson: LessonPackage): LessonPackage {
  let current = lesson;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = cleanOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

function cleanOnce(lesson: LessonPackage): LessonPackage {
  const originals = lesson.steps.flatMap((step) => step.guidePaths.filter((path) => path.role === 'final-outline'));
  const repaired = repairOutlines(originals.map((path) => ({ id: path.id, d: path.d })));
  if (repaired.size === 0) return lesson;
  return {
    ...lesson,
    steps: lesson.steps.map((step) => ({
      ...step,
      guidePaths: step.guidePaths.map((path) => {
        const next = path.role === 'final-outline' ? repaired.get(path.id) : undefined;
        return next ? { ...path, d: next } : path;
      }),
    })),
    targetPreview: {
      paths: lesson.targetPreview.paths.map((path) => {
        const next = repaired.get(path.id);
        return next ? { ...path, d: next } : path;
      }),
    },
  };
}

function repairOutlines(paths: readonly { id: string; d: string }[]): Map<string, string> {
  const contours = new Map(paths.map((path) => [path.id, flattenContours(path.d)]));
  const closed = new Map(paths.map((path) => [path.id, isClosed(contours.get(path.id) ?? [])]));
  let changed = false;
  for (let pass = 0; pass < 3; pass += 1) {
    for (const path of paths) {
      const mine = contours.get(path.id) ?? [];
      let next = mine;
      for (const other of paths) {
        if (other.id === path.id) continue;
        const theirs = contours.get(other.id) ?? [];
        if (closed.get(path.id) && closed.get(other.id)) {
          if (areaOf(mine) + 1 < areaOf(theirs)) continue;
          next = cutClosedByFront(next, theirs);
        } else if (!closed.get(path.id) && closed.get(other.id)) {
          next = keepOutside(next, theirs);
        } else if (!closed.get(path.id) && !closed.get(other.id)) {
          next = splitAtCrossings(next, theirs);
        }
      }
      if (next.length > 1) {
        const split: Point[][] = [];
        for (let index = 0; index < next.length; index += 1) {
          const rest = next.filter((_, other) => other !== index);
          split.push(...splitAtCrossings([next[index]!], rest));
        }
        next = split;
      }
      if (serialize(next) !== serialize(mine)) {
        contours.set(path.id, next);
        changed = true;
      }
    }
  }
  const result = new Map<string, string>();
  if (!changed) return result;
  for (const path of paths) {
    const next = contours.get(path.id) ?? [];
    const d = serialize(next);
    if (d.length > 0 && d !== path.d) result.set(path.id, d);
  }
  return result;
}

function cutClosedByFront(host: Point[][], front: Point[][]): Point[][] {
  const frontPoly = front[0] ?? [];
  if (frontPoly.length < 3) return host;
  return host.flatMap((contour) => {
    const cuts = crossingsBetween(contour, frontPoly);
    if (cuts.length === 0) return [contour];
    return keepOutside([contour], front);
  });
}

function keepOutside(chains: Point[][], front: Point[][]): Point[][] {
  const polygon = front[0] ?? [];
  if (polygon.length < 3) return chains;
  const kept: Point[][] = [];
  for (const chain of chains) {
    const cuts = crossingsBetween(chain, polygon);
    const pieces = splitChain(chain, cuts);
    for (const piece of pieces) {
      const mid = piece[Math.floor(piece.length / 2)]!;
      if (!pointInPolygon(mid, polygon)) kept.push(piece);
    }
  }
  return kept.length > 0 ? kept : chains;
}

function splitAtCrossings(chains: Point[][], other: Point[][]): Point[][] {
  const kept: Point[][] = [];
  for (const chain of chains) {
    const cuts = other.flatMap((contour) => crossingsBetween(chain, contour));
    kept.push(...splitChain(chain, cuts));
  }
  return kept;
}

function splitChain(chain: readonly Point[], cuts: readonly Point[]): Point[][] {
  if (cuts.length === 0 || chain.length < 2) return [chain.map((point) => ({ ...point }))];
  const pieces: Point[][] = [];
  let current: Point[] = [{ ...chain[0]! }];
  for (let i = 0; i < chain.length - 1; i += 1) {
    const a = chain[i]!;
    const b = chain[i + 1]!;
    const onSegment = cuts
      .map((cut) => ({ cut, t: project(a, b, cut) }))
      .filter((item) => item.t > 0.02 && item.t < 0.98 && distanceToSegment(item.cut, a, b) < 1.5)
      .sort((left, right) => left.t - right.t);
    let cursor = a;
    for (const item of onSegment) {
      current.push(item.cut);
      if (current.length >= 2) pieces.push(current);
      current = [item.cut];
      cursor = item.cut;
    }
    if (distance(cursor, b) > 0.5) current.push({ ...b });
  }
  if (current.length >= 2) pieces.push(current);
  return pieces.length > 0 ? pieces : [chain.map((point) => ({ ...point }))];
}

function isClosed(contours: Point[][]): boolean {
  const contour = contours[0];
  if (!contour || contour.length < 4) return false;
  return distance(contour[0]!, contour[contour.length - 1]!) < 2;
}

function areaOf(contours: Point[][]): number {
  const contour = contours[0] ?? [];
  let sum = 0;
  for (let i = 0; i < contour.length - 1; i += 1) {
    sum += contour[i]!.x * contour[i + 1]!.y - contour[i + 1]!.x * contour[i]!.y;
  }
  return Math.abs(sum) / 2;
}

function serialize(contours: Point[][]): string {
  return contours
    .filter((contour) => contour.length >= 2)
    .map((contour) => contour.map((point, index) => {
      const verb = index === 0 ? 'M' : 'L';
      return `${verb} ${round(point.x)} ${round(point.y)}`;
    }).join(' '))
    .join(' ');
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function project(a: Point, b: Point, point: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const length = abx * abx + aby * aby;
  if (length === 0) return 0;
  return ((point.x - a.x) * abx + (point.y - a.y) * aby) / length;
}

export function flattenContours(d: string): Point[][] {
  const tokens = d.match(/[MmLlHhVvCcQqAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  if (!tokens) return [];
  const contours: Point[][] = [];
  let points: Point[] = [];
  const startContour = () => {
    if (points.length > 0) contours.push(points);
    points = [];
  };
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const read = () => Number(tokens[index++]);
  const absolute = (value: number, origin: number) => (command === command.toUpperCase() ? value : origin + value);
  const add = (px: number, py: number) => {
    const last = points[points.length - 1];
    if (!last || distance(last, { x: px, y: py }) > 0.5) points.push({ x: px, y: py });
    x = px;
    y = py;
  };

  while (index < tokens.length) {
    if (/[A-Za-z]/.test(tokens[index]!)) command = tokens[index++]!;
    if (!command) break;
    const op = command.toUpperCase();
    if (op === 'Z') {
      add(startX, startY);
      continue;
    }
    if (index >= tokens.length || /[A-Za-z]/.test(tokens[index]!)) continue;
    if (op === 'M' || op === 'L') {
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      if (op === 'M' && points.length > 0) startContour();
      add(nextX, nextY);
      if (op === 'M') {
        startX = x;
        startY = y;
        command = command === 'm' ? 'l' : 'L';
      }
    } else if (op === 'H') {
      add(absolute(read(), x), y);
    } else if (op === 'V') {
      add(x, absolute(read(), y));
    } else if (op === 'C') {
      const x1 = absolute(read(), x);
      const y1 = absolute(read(), y);
      const x2 = absolute(read(), x);
      const y2 = absolute(read(), y);
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      sampleCubic({ x, y }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: nextX, y: nextY }).forEach((point) => add(point.x, point.y));
    } else if (op === 'Q') {
      const cx = absolute(read(), x);
      const cy = absolute(read(), y);
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      sampleQuad({ x, y }, { x: cx, y: cy }, { x: nextX, y: nextY }).forEach((point) => add(point.x, point.y));
    } else if (op === 'A') {
      const rx = Math.abs(read());
      const ry = Math.abs(read());
      read();
      const large = read();
      const sweep = read();
      const nextX = absolute(read(), x);
      const nextY = absolute(read(), y);
      sampleArc({ x, y }, rx, ry, large, sweep, { x: nextX, y: nextY }).forEach((point) => add(point.x, point.y));
    } else {
      break;
    }
  }
  startContour();
  return contours;
}

function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point): Point[] {
  const points: Point[] = [];
  for (let step = 1; step <= SAMPLE; step += 1) {
    const t = step / SAMPLE;
    const u = 1 - t;
    points.push({
      x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
      y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
    });
  }
  return points;
}

function sampleQuad(p0: Point, p1: Point, p2: Point): Point[] {
  const points: Point[] = [];
  for (let step = 1; step <= SAMPLE; step += 1) {
    const t = step / SAMPLE;
    const u = 1 - t;
    points.push({
      x: u ** 2 * p0.x + 2 * u * t * p1.x + t ** 2 * p2.x,
      y: u ** 2 * p0.y + 2 * u * t * p1.y + t ** 2 * p2.y,
    });
  }
  return points;
}

function sampleArc(start: Point, rx: number, ry: number, large: number, sweep: number, end: Point): Point[] {
  if (rx === 0 || ry === 0) return [end];
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const radiusX = Math.abs(rx);
  const radiusY = Math.abs(ry);
  let scale = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
  let rxUse = radiusX;
  let ryUse = radiusY;
  if (scale > 1) {
    scale = Math.sqrt(scale);
    rxUse *= scale;
    ryUse *= scale;
  }
  const sign = large === sweep ? -1 : 1;
  const coef = sign * Math.sqrt(Math.max(0,
    (rxUse * rxUse * ryUse * ryUse - rxUse * rxUse * dy * dy - ryUse * ryUse * dx * dx)
    / (rxUse * rxUse * dy * dy + ryUse * ryUse * dx * dx),
  ));
  const cxp = coef * (rxUse * dy / ryUse);
  const cyp = coef * -(ryUse * dx / rxUse);
  const center = { x: (start.x + end.x) / 2 + cxp, y: (start.y + end.y) / 2 + cyp };
  const startAngle = Math.atan2((start.y - center.y) / ryUse, (start.x - center.x) / rxUse);
  const endAngle = Math.atan2((end.y - center.y) / ryUse, (end.x - center.x) / rxUse);
  let delta = endAngle - startAngle;
  if (sweep === 0 && delta > 0) delta -= Math.PI * 2;
  if (sweep === 1 && delta < 0) delta += Math.PI * 2;
  const points: Point[] = [];
  const steps = Math.max(SAMPLE, Math.ceil(Math.abs(delta) / (Math.PI / 8)));
  for (let step = 1; step <= steps; step += 1) {
    const angle = startAngle + delta * (step / steps);
    points.push({
      x: center.x + rxUse * Math.cos(angle),
      y: center.y + ryUse * Math.sin(angle),
    });
  }
  return points;
}

function segmentCross(a: Point, b: Point, c: Point, d: Point): Point | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const denom = abx * cdy - aby * cdx;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((c.x - a.x) * cdy - (c.y - a.y) * cdx) / denom;
  const u = ((c.x - a.x) * aby - (c.y - a.y) * abx) / denom;
  if (t <= 0.02 || t >= 0.98 || u <= 0.02 || u >= 0.98) return null;
  return { x: a.x + t * abx, y: a.y + t * aby };
}

function nearEnd(hit: Point, a: Point, b: Point): boolean {
  return distance(hit, a) <= JUNCTION || distance(hit, b) <= JUNCTION;
}

function covered(point: Point, polygon: readonly Point[]): boolean {
  if (polygon.length < 3) return false;
  if (pointInPolygon(point, polygon)) return true;
  for (let i = 0; i < polygon.length - 1; i += 1) {
    if (distanceToSegment(point, polygon[i]!, polygon[i + 1]!) <= 8) return true;
  }
  return false;
}

function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersect = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 1e-9) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const length = abx * abx + aby * aby;
  if (length === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / length));
  return distance(point, { x: a.x + t * abx, y: a.y + t * aby });
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
