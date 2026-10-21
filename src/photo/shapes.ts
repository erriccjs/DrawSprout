/**
 * Fit a traced subject to a few basic shapes, the way the catalogue lessons
 * are drawn (a circle for a head, triangles for ears).
 *
 * The guide a child sees is that clean shape, not the marching-squares
 * polyline. A symmetric pair is one step. The count follows the parts that
 * survive the speck and duplicate filters. See D-68.
 */

import type { Point } from './trace';

export const LESSON_WIDTH = 1000;
export const LESSON_HEIGHT = 750;
/** Largest fitted piece, or the pieces together, versus the ink box. */
export const LOW_SUBJECT_COVERAGE = 0.35;
/** A shape proposal must overlap a traced part by at least this much. */
export const MIN_SNAP_IOU = 0.15;
/** One step is one shape, or one mirrored pair. */
export const MAX_PATHS_PER_STEP = 2;

export type PrimitiveKind = 'circle' | 'ellipse' | 'rounded-rect' | 'triangle' | 'line';

export interface MappedContour {
  readonly points: readonly Point[];
  readonly closed: boolean;
  readonly area: number;
  readonly length: number;
  readonly cx: number;
  readonly cy: number;
  readonly nx: number;
  readonly ny: number;
  readonly silhouette: boolean;
}

export interface ShapeProposal {
  readonly primitive: PrimitiveKind;
  readonly name: string;
  readonly pair: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface ShapeTarget {
  readonly id: string;
  readonly primitive: PrimitiveKind;
  readonly pair: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PlannedPlace {
  readonly nx: number;
  readonly ny: number;
  readonly path: string;
  readonly area: number;
}

export interface PlannedPart {
  readonly kind: PrimitiveKind;
  readonly name: string;
  readonly pair: boolean;
  readonly paths: readonly string[];
  readonly places: readonly PlannedPlace[];
  readonly pieceArea: number;
  readonly boxArea: number;
}

export interface ShapePlan {
  readonly parts: readonly PlannedPart[];
  readonly targets: readonly ShapeTarget[];
  /** Largest single shape box / subject box. */
  readonly coverage: number;
  /** Union of the fitted shapes / subject box. */
  readonly subjectFit: number;
}

const KINDS: readonly PrimitiveKind[] = ['circle', 'ellipse', 'rounded-rect', 'triangle', 'line'];

const SHAPE_WORD: Record<PrimitiveKind, string> = {
  circle: 'lingkaran',
  ellipse: 'oval',
  'rounded-rect': 'persegi panjang',
  triangle: 'segitiga',
  line: 'garis',
};

export function knownPrimitive(value: string): PrimitiveKind | null {
  return KINDS.find((kind) => kind === value) ?? null;
}

export function shouldRedraw(subjectFit: number): boolean {
  return subjectFit < LOW_SUBJECT_COVERAGE;
}

export function shapeInstruction(kind: PrimitiveKind, name: string, pair: boolean, prominent: boolean): string {
  const word = SHAPE_WORD[kind];
  if (pair) return `Tambahkan dua ${word} untuk ${name}.`;
  if (kind === 'line') return `Tambahkan garis untuk ${name}.`;
  if (prominent) return `Gambar ${word} besar untuk ${name}.`;
  return `Gambar ${word} untuk ${name}.`;
}

export function cleanPartName(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[^\p{L}\p{N} '-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^dua\s+/, '');
  if (cleaned.length < 2 || cleaned.length > 40 || rejectsName(cleaned)) return fallback;
  return cleaned;
}

export function planShapes(contours: readonly MappedContour[], proposals?: readonly ShapeProposal[]): ShapePlan {
  const cleaned = meaningful(contours);
  const pool = drawingPool(cleaned);
  let drafts = pairDrafts(pool.map((contour) => fitContour(contour))).sort(byPiece);
  const targets = toTargets(drafts);
  if (proposals && proposals.length > 0) drafts = applyProposals(drafts, proposals).sort(byPiece);
  const named = withNames(drafts);
  const subject = unionBox(cleaned.map((contour) => boxOf(contour.points)));
  const covered = unionBox(named.map((part) => part.box));
  const piece = named.reduce((max, part) => Math.max(max, part.pieceArea), 0);
  const subjectArea = Math.max(1, subject.area);
  return {
    parts: named.map(toPart),
    targets,
    coverage: piece / subjectArea,
    subjectFit: covered.area / subjectArea,
  };
}

function rejectsName(text: string): boolean {
  return /latar belakang|wajah anak|ventilasi|barcode/i.test(text);
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly area: number;
}

interface Draft {
  readonly kind: PrimitiveKind;
  readonly name: string;
  readonly pair: boolean;
  readonly contours: readonly MappedContour[];
  readonly paths: readonly string[];
  readonly box: Box;
  readonly pieceArea: number;
  readonly cx: number;
  readonly cy: number;
}

function fitContour(contour: MappedContour): Draft {
  return makeDraft(classify(contour), '', [contour]);
}

function makeDraft(kind: PrimitiveKind, name: string, contours: readonly MappedContour[]): Draft {
  const paths = contours.map((contour) => pathFor(kind, contour.points));
  const boxes = contours.map((contour) => boxOf(contour.points));
  const box = unionBox(boxes);
  const pieceArea = boxes.reduce((max, item) => Math.max(max, item.area), 0);
  const cx = contours.reduce((sum, contour) => sum + contour.cx, 0) / Math.max(1, contours.length);
  const cy = contours.reduce((sum, contour) => sum + contour.cy, 0) / Math.max(1, contours.length);
  return {
    kind,
    name,
    pair: contours.length > 1,
    contours,
    paths,
    box,
    pieceArea,
    cx,
    cy,
  };
}

function pairDrafts(drafts: readonly Draft[]): Draft[] {
  const largest = drafts.reduce((max, draft) => Math.max(max, draft.pieceArea), 0);
  const mirrorPair = drafts.length === 2 && drafts[0] && drafts[1] && mirrors(drafts[0], drafts[1]);
  const used = new Set<number>();
  const out: Draft[] = [];
  const order = drafts.map((_, index) => index).sort((left, right) => {
    const a = drafts[left];
    const b = drafts[right];
    return (b?.pieceArea ?? 0) - (a?.pieceArea ?? 0);
  });
  for (const index of order) {
    if (used.has(index)) continue;
    const part = drafts[index];
    if (!part) continue;
    used.add(index);
    const match = mirrorIndex(drafts, order, used, part, largest, mirrorPair === true);
    const other = match === null ? undefined : drafts[match];
    if (match !== null && other) {
      used.add(match);
      out.push(makeDraft(part.kind, '', [...part.contours, ...other.contours]));
    } else {
      out.push(part);
    }
  }
  return out;
}

function mirrorIndex(
  drafts: readonly Draft[],
  order: readonly number[],
  used: ReadonlySet<number>,
  part: Draft,
  largest: number,
  onlyTwo: boolean,
): number | null {
  const partEligible = onlyTwo || part.pieceArea < largest * 0.85;
  if (!partEligible) return null;
  let match: number | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const otherIndex of order) {
    if (used.has(otherIndex)) continue;
    const candidate = drafts[otherIndex];
    if (!candidate || !mirrors(part, candidate)) continue;
    if (!onlyTwo && candidate.pieceArea >= largest * 0.85) continue;
    const distance = Math.hypot(part.cx - candidate.cx, part.cy - candidate.cy);
    if (distance < best) {
      best = distance;
      match = otherIndex;
    }
  }
  return match;
}

function mirrors(left: Draft, right: Draft): boolean {
  if (left.kind !== right.kind) return false;
  const ratio = left.pieceArea / Math.max(1, right.pieceArea);
  if (ratio < 0.55 || ratio > 1.82) return false;
  const leftSpan = Math.max(left.box.maxX - left.box.minX, left.box.maxY - left.box.minY, 1);
  const rightSpan = Math.max(right.box.maxX - right.box.minX, right.box.maxY - right.box.minY, 1);
  const size = Math.max(leftSpan, rightSpan);
  const dx = Math.abs(left.cx - right.cx);
  const dy = Math.abs(left.cy - right.cy);
  if (dy < size * 0.55 && dx > size * 0.9) return true;
  return dx < size * 0.55 && dy > size * 0.9;
}

function applyProposals(drafts: readonly Draft[], proposals: readonly ShapeProposal[]): Draft[] {
  const consumed = new Set<number>();
  const next: Draft[] = [];
  for (const proposal of proposals) {
    const box = proposalBox(proposal);
    if (!box || box.area < 1) continue;
    const hits = drafts
      .map((part, index) => ({ part, index }))
      .filter((item) => !consumed.has(item.index) && snaps(item.part, box))
      .sort((left, right) => iou(right.part.box, box) - iou(left.part.box, box));
    const first = hits[0];
    const second = hits[1];
    if (!first) continue;
    const name = cleanPartName(proposal.name, first.part.name || fallbackName(0));
    const leftContour = first.part.contours[0];
    const rightContour = second?.part.contours[0];
    if (
      proposal.pair
      && second
      && leftContour
      && rightContour
      && first.part.contours.length === 1
      && second.part.contours.length === 1
      && similarPiece(first.part, second.part)
    ) {
      consumed.add(first.index);
      consumed.add(second.index);
      next.push(makeDraft(proposal.primitive, name, [leftContour, rightContour]));
      continue;
    }
    consumed.add(first.index);
    next.push(makeDraft(proposal.primitive, name, first.part.contours));
  }
  drafts.forEach((part, index) => {
    if (!consumed.has(index)) next.push(part);
  });
  return next;
}

function similarPiece(left: Draft, right: Draft): boolean {
  const ratio = left.pieceArea / Math.max(1, right.pieceArea);
  return ratio >= 0.55 && ratio <= 1.82;
}

function snaps(part: Draft, box: Box): boolean {
  if (iou(part.box, box) >= MIN_SNAP_IOU) return true;
  return part.cx >= box.minX && part.cx <= box.maxX && part.cy >= box.minY && part.cy <= box.maxY;
}

function proposalBox(proposal: ShapeProposal): Box | null {
  if (!Number.isFinite(proposal.x) || !Number.isFinite(proposal.y)) return null;
  if (!Number.isFinite(proposal.width) || !Number.isFinite(proposal.height)) return null;
  if (proposal.width <= 0 || proposal.height <= 0) return null;
  return {
    minX: proposal.x,
    minY: proposal.y,
    maxX: proposal.x + proposal.width,
    maxY: proposal.y + proposal.height,
    area: proposal.width * proposal.height,
  };
}

function withNames(drafts: readonly Draft[]): Draft[] {
  return [...drafts].sort(byPiece).map((draft, index) => ({
    ...draft,
    name: draft.name || fallbackName(index),
  }));
}

function fallbackName(index: number): string {
  return index === 0 ? 'bentuk utamanya' : 'bagian berikutnya';
}

function toTargets(drafts: readonly Draft[]): ShapeTarget[] {
  return drafts.map((draft, index) => ({
    id: `part-${index + 1}`,
    primitive: draft.kind,
    pair: draft.pair,
    x: round(draft.box.minX),
    y: round(draft.box.minY),
    width: round(draft.box.maxX - draft.box.minX),
    height: round(draft.box.maxY - draft.box.minY),
  }));
}

function toPart(draft: Draft): PlannedPart {
  const places = draft.contours.map((contour, index) => ({
    nx: contour.nx,
    ny: contour.ny,
    path: draft.paths[index] ?? pathFor(draft.kind, contour.points),
    area: boxOf(contour.points).area,
  }));
  return {
    kind: draft.kind,
    name: draft.name,
    pair: draft.pair,
    paths: places.map((place) => place.path),
    places,
    pieceArea: draft.pieceArea,
    boxArea: draft.box.area,
  };
}

function byPiece(left: Draft, right: Draft): number {
  return right.pieceArea - left.pieceArea;
}

function meaningful(contours: readonly MappedContour[]): MappedContour[] {
  if (contours.length === 0) return [];
  const ordered = [...contours].sort((left, right) => boxOf(right.points).area - boxOf(left.points).area);
  const main = boxOf(ordered[0]?.points ?? []);
  const kept: MappedContour[] = [];
  for (const contour of ordered) {
    if (isSpeck(contour, main) || isShortStroke(contour, main)) continue;
    const box = boxOf(contour.points);
    const duplicate = kept.some((other) => {
      const otherBox = boxOf(other.points);
      const ratio = box.area / Math.max(1, otherBox.area);
      return iou(box, otherBox) >= 0.82 && ratio > 0.6 && ratio < 1.7;
    });
    if (!duplicate) kept.push(contour);
  }
  if (kept.length > 0) return kept;
  const largest = ordered[0];
  return largest ? [largest] : [];
}

function drawingPool(contours: readonly MappedContour[]): readonly MappedContour[] {
  const silhouette = contours.find((contour) => contour.silhouette);
  const details = contours.filter((contour) => contour !== silhouette);
  if (!silhouette || details.length === 0) return contours;
  const detailBox = unionBox(details.map((contour) => boxOf(contour.points)));
  const outer = boxOf(silhouette.points);
  if (detailBox.area >= outer.area * 0.45) return details;
  return contours;
}

function isSpeck(contour: MappedContour, main: Box): boolean {
  const box = boxOf(contour.points);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const mainSpan = Math.max(1, main.maxX - main.minX, main.maxY - main.minY);
  if (span < 18 && box.area < 250) return true;
  return span < mainSpan * 0.04 && box.area < main.area * 0.005;
}

function isShortStroke(contour: MappedContour, main: Box): boolean {
  if (contour.closed) return false;
  const box = boxOf(contour.points);
  const span = Math.max(box.maxX - box.minX, box.maxY - box.minY);
  const mainSpan = Math.max(1, main.maxX - main.minX, main.maxY - main.minY);
  return span < mainSpan * 0.08;
}

function classify(contour: MappedContour): PrimitiveKind {
  const box = boxOf(contour.points);
  const width = Math.max(0, box.maxX - box.minX);
  const height = Math.max(0, box.maxY - box.minY);
  const short = Math.min(width, height);
  const long = Math.max(width, height, 1);
  const fill = contour.area / Math.max(1, box.area);
  if (!contour.closed || long / Math.max(1, short) > 3.2 || fill < 0.18 || short < 12) return 'line';
  const corners = cornerCount(contour.points);
  if (corners === 3 && fill < 0.75) return 'triangle';
  if (corners >= 4 && fill > 0.55) return 'rounded-rect';
  if (long / Math.max(1, short) < 1.28) return 'circle';
  return 'ellipse';
}

function pathFor(kind: PrimitiveKind, points: readonly Point[]): string {
  const fitted = fitBox(points);
  if (kind === 'circle') return circlePath(fitted.cx, fitted.cy, Math.max(1, (fitted.width + fitted.height) / 4));
  if (kind === 'ellipse') return ellipsePath(fitted.cx, fitted.cy, Math.max(1, fitted.width / 2), Math.max(1, fitted.height / 2), fitted.rotation);
  if (kind === 'rounded-rect') return roundedRectPath(fitted.cx, fitted.cy, Math.max(1, fitted.width), Math.max(1, fitted.height), fitted.rotation);
  if (kind === 'triangle') return trianglePath(points);
  return linePath(points);
}

interface FittedBox {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

function fitBox(points: readonly Point[]): FittedBox {
  const aligned = boxOf(points);
  const width = Math.max(0, aligned.maxX - aligned.minX);
  const height = Math.max(0, aligned.maxY - aligned.minY);
  const cx = (aligned.minX + aligned.maxX) / 2;
  const cy = (aligned.minY + aligned.maxY) / 2;
  if (width < 1 || height < 1 || Math.max(width, height) / Math.max(1, Math.min(width, height)) < 1.15) {
    return { cx, cy, width, height, rotation: 0 };
  }
  const angle = majorAxis(points, cx, cy);
  if (Math.abs(angle) < 0.2 || Math.abs(Math.abs(angle) - Math.PI / 2) < 0.2) {
    return { cx, cy, width, height, rotation: 0 };
  }
  const local = points.map((point) => rotate(point.x - cx, point.y - cy, -angle));
  const box = boxOf(local);
  return {
    cx,
    cy,
    width: Math.max(0, box.maxX - box.minX),
    height: Math.max(0, box.maxY - box.minY),
    rotation: (angle * 180) / Math.PI,
  };
}

function majorAxis(points: readonly Point[], cx: number, cy: number): number {
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of points) {
    const dx = point.x - cx;
    const dy = point.y - cy;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  return Math.atan2(2 * xy, xx - yy) / 2;
}

function circlePath(cx: number, cy: number, radius: number): string {
  return ellipsePath(cx, cy, radius, radius, 0);
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number, rotation: number): string {
  const left = rot(cx, cy, -rx, 0, rotation);
  const right = rot(cx, cy, rx, 0, rotation);
  const sweep = `${n(rx)} ${n(ry)} ${n(rotation)} 1 1`;
  return `M ${n(left.x)} ${n(left.y)} A ${sweep} ${n(right.x)} ${n(right.y)} A ${sweep} ${n(left.x)} ${n(left.y)} Z`;
}

function roundedRectPath(cx: number, cy: number, width: number, height: number, rotation: number): string {
  const radius = Math.min(width, height) * 0.18;
  const left = -width / 2;
  const top = -height / 2;
  const right = width / 2;
  const bottom = height / 2;
  const point = (x: number, y: number) => {
    const turned = rot(cx, cy, x, y, rotation);
    return `${n(turned.x)} ${n(turned.y)}`;
  };
  const arc = (x: number, y: number) => `A ${n(radius)} ${n(radius)} ${n(rotation)} 0 1 ${point(x, y)}`;
  return [
    `M ${point(left + radius, top)}`,
    `L ${point(right - radius, top)}`,
    arc(right, top + radius),
    `L ${point(right, bottom - radius)}`,
    arc(right - radius, bottom),
    `L ${point(left + radius, bottom)}`,
    arc(left, bottom - radius),
    `L ${point(left, top + radius)}`,
    arc(left + radius, top),
    'Z',
  ].join(' ');
}

function trianglePath(points: readonly Point[]): string {
  const [a, b, c] = triangleVertices(points);
  return `M ${n(a.x)} ${n(a.y)} L ${n(b.x)} ${n(b.y)} L ${n(c.x)} ${n(c.y)} Z`;
}

function triangleVertices(points: readonly Point[]): [Point, Point, Point] {
  const ring = openRing(points);
  const box = boxOf(ring.length > 0 ? ring : points);
  const fallback: [Point, Point, Point] = [
    { x: (box.minX + box.maxX) / 2, y: box.minY },
    { x: box.minX, y: box.maxY },
    { x: box.maxX, y: box.maxY },
  ];
  if (ring.length < 3) return fallback;
  const center = centroid(ring);
  const first = farthest(ring, center);
  const second = farthest(ring, first);
  let third = ring[0] ?? first;
  let best = -1;
  for (const point of ring) {
    const distance = pointLineDistance(point, first, second);
    if (distance > best) {
      best = distance;
      third = point;
    }
  }
  if (best < Math.hypot(first.x - second.x, first.y - second.y) * 0.08) return fallback;
  return [first, second, third];
}

function linePath(points: readonly Point[]): string {
  const ring = points.length > 0 ? points : [{ x: 0, y: 0 }];
  let start = ring[0] ?? { x: 0, y: 0 };
  let end = ring[ring.length - 1] ?? start;
  let span = -1;
  for (let i = 0; i < ring.length; i += 1) {
    for (let j = i + 1; j < ring.length; j += 1) {
      const left = ring[i];
      const right = ring[j];
      if (!left || !right) continue;
      const distance = Math.hypot(left.x - right.x, left.y - right.y);
      if (distance > span) {
        span = distance;
        start = left;
        end = right;
      }
    }
  }
  let bow = start;
  let bowDistance = 0;
  for (const point of ring) {
    const distance = pointLineDistance(point, start, end);
    if (distance > bowDistance) {
      bowDistance = distance;
      bow = point;
    }
  }
  if (bowDistance > span * 0.12) {
    return `M ${n(start.x)} ${n(start.y)} Q ${n(bow.x)} ${n(bow.y)} ${n(end.x)} ${n(end.y)}`;
  }
  return `M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}`;
}

function cornerCount(points: readonly Point[]): number {
  const ring = openRing(points);
  if (ring.length < 3) return ring.length;
  const sharp: number[] = [];
  for (let index = 0; index < ring.length; index += 1) {
    const prev = ring[(index - 1 + ring.length) % ring.length];
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    if (!prev || !current || !next) continue;
    if (turn(prev, current, next) < 2.2) sharp.push(index);
  }
  const firstSharp = sharp[0];
  if (firstSharp === undefined) return 0;
  if (ring.length <= 8) return sharp.length;
  let clusters = 1;
  for (let index = 1; index < sharp.length; index += 1) {
    const previous = sharp[index - 1] ?? firstSharp;
    const current = sharp[index] ?? previous;
    if (current - previous > 2) clusters += 1;
  }
  const lastSharp = sharp[sharp.length - 1] ?? firstSharp;
  if (sharp.length > 1 && ring.length - lastSharp + firstSharp <= 2) clusters -= 1;
  return Math.max(1, clusters);
}

function turn(prev: Point, current: Point, next: Point): number {
  const ax = prev.x - current.x;
  const ay = prev.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const denom = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (denom < 1e-6) return Math.PI;
  const dot = (ax * bx + ay * by) / denom;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function openRing(points: readonly Point[]): Point[] {
  if (points.length < 2) return [...points];
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && Math.hypot(first.x - last.x, first.y - last.y) < 1.5) return points.slice(0, -1);
  return [...points];
}

function farthest(points: readonly Point[], from: Point): Point {
  let best = points[0] ?? from;
  let distance = -1;
  for (const point of points) {
    const gap = Math.hypot(point.x - from.x, point.y - from.y);
    if (gap > distance) {
      distance = gap;
      best = point;
    }
  }
  return best;
}

function centroid(points: readonly Point[]): Point {
  const count = Math.max(1, points.length);
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / count,
    y: points.reduce((sum, point) => sum + point.y, 0) / count,
  };
}

function pointLineDistance(point: Point, start: Point, end: Point): number {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 1e-6) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs((end.x - start.x) * (start.y - point.y) - (start.x - point.x) * (end.y - start.y)) / length;
}

function boxOf(points: readonly Point[]): Box {
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

function unionBox(boxes: readonly Box[]): Box {
  const first = boxes[0];
  if (!first) return { minX: 0, minY: 0, maxX: 0, maxY: 0, area: 0 };
  const merged = boxes.reduce((box, next) => ({
    minX: Math.min(box.minX, next.minX),
    minY: Math.min(box.minY, next.minY),
    maxX: Math.max(box.maxX, next.maxX),
    maxY: Math.max(box.maxY, next.maxY),
    area: 0,
  }), first);
  return { ...merged, area: Math.max(0, merged.maxX - merged.minX) * Math.max(0, merged.maxY - merged.minY) };
}

function iou(left: Box, right: Box): number {
  const width = Math.max(0, Math.min(left.maxX, right.maxX) - Math.max(left.minX, right.minX));
  const height = Math.max(0, Math.min(left.maxY, right.maxY) - Math.max(left.minY, right.minY));
  const intersection = width * height;
  const union = left.area + right.area - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function rot(cx: number, cy: number, x: number, y: number, degrees: number): Point {
  const turned = rotate(x, y, (degrees * Math.PI) / 180);
  return { x: cx + turned.x, y: cy + turned.y };
}

function rotate(x: number, y: number, radians: number): Point {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function n(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
