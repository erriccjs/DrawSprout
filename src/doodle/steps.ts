/**
 * Turns a line doodle and the original photo into a lesson.
 *
 * Line steps follow the doodle. One object is drawn completely before the
 * next. Inside an object the parts go in drawing order: head, body, arms,
 * then legs for a living subject, or top, middle, then bottom for anything
 * else. Colour steps come after every line, one crayon at a time.
 */

import { packageLesson } from '../categories/author';
import { ellipse } from '../categories/shapes';
import type { GuidePath, LessonPackage, LessonStep } from '../lesson-data/schema';
import { fitPhoto, type TracePlacement } from '../trace/placement';
import { coverByColour, regionsColouredBy, type FlatRegion } from '../photo/flat-colour';
import type { RgbaImage } from '../photo/png';
import { subjectSilhouettes, traceInk } from '../photo/trace';

const SPACE_W = 1000;
const SPACE_H = 750;
const INK = 128;
// This layer sets no budget of its own: every area the drawing encloses and
// the photo gives a colour to earns a step. `regionsColouredBy` already ranks
// by size and keeps at most 24, and that is the only ceiling.
const MAX_COLOURS = 24;
/** Below this share of the picture an area is a speck, not something to paint. */
const SMALLEST_REGION = 0.0004;
/**
 * What a child paints where the photo is white.
 *
 * A white plush, a white shirt, a white wall: the photo says white, and pure
 * white on white paper is a step that shows nothing for the effort. This is
 * the nearest shade that still reads as white and can be seen once it is down.
 */
const PAPER_WHITE = '#eae5da';

export function buildDoodleLesson(doodle: RgbaImage, photo: RgbaImage): LessonPackage {
  const scaled = downscaleMask(inkMask(doodle), doodle.width, doodle.height, 280);
  const { ink, width, height } = scaled;
  const count = ink.reduce((sum, bit) => sum + bit, 0);
  if (count < 40) throw new Error('Doodle-nya terlalu kosong.');
  const bounds = boundsOf(ink, width, height);
  // The guides and the traced picture share one placement, so they cannot drift.
  const frame = fitPhoto(SPACE_W, SPACE_H, width, height);
  const scale = frame.width / Math.max(1, width);
  // The outline has to follow the subject. A convex hull turns every gap --
  // between two legs, under an arm, around an ear -- into one filled blob, so
  // the child is asked to draw a shadow instead of the thing in the photo.
  const artScale = frame.width / Math.max(1, doodle.width);
  const sections = lineSections(doodle);
  const hull = sections.hull.length >= 3
    ? sections.hull.map((point) => [point[0] * (width / doodle.width), point[1] * (height / doodle.height)] as [number, number])
    : convexHull(sampleInk(ink, width, bounds));
  if (hull.length < 3) throw new Error('Doodle-nya terlalu kosong.');
  // The areas the drawing already encloses, each taking the colour the photo
  // has inside it. A handful of ellipses over the middle of the page could
  // never match a photo, whatever colours went into them.
  const filled = filledRegions(doodle, photo, frame, artScale);
  const colours = filled.length > 0 ? [] : subjectColours(width, height, photo, ink, hull, frame, scale);
  const shape = pathFrom(hull.map((point) => toSpace(point, frame, scale)), true);
  const steps: LessonStep[] = [];
  sections.parts.forEach((part, index) => {
    const guidePaths: GuidePath[] = [];
    part.chains.forEach((chain, chainIndex) => {
      const d = pathFrom(chain.map((point) => toSpace(
        [point[0] * (width / doodle.width), point[1] * (height / doodle.height)],
        frame,
        scale,
      )), true);
      if (d.length < 8) return;
      guidePaths.push({
        id: `line-${index + 1}-${chainIndex + 1}`,
        d,
        role: 'final-outline',
      });
    });
    if (guidePaths.length === 0) return;
    steps.push(outlineStep(`line-${index + 1}`, part.instruction, part.hint, guidePaths));
  });
  if (steps.length === 0) {
    steps.push(outlineStep('shape', 'Gambar bentuk besarnya.', 'Mulai dari bentuk yang paling besar.', [
      { id: 'shape', d: shape, role: 'final-outline' },
    ]));
  }

  // One colour, one step, however many places it covers. A plush's body, head
  // and legs are the same cream: painting it is one thing a child decides to
  // do, not ten. `colorRegionIds` already takes a list, and the photo pipeline
  // buckets its colours the same way.
  const buckets = filled.length > 0
    ? colourBuckets(filled)
    : colourBuckets(colours.map((colour, index) => ({
      // One colour means one subject to fill, and the body is the nicer shape
      // to hand a child. Several colours means several places, so each gets
      // the patch its own samples cover. A near-black never takes the body:
      // that is what reads as a shadow.
      d: index === 0 && colours.length === 1 && !isShadowHex(colour.hex)
        ? shape
        : `${ellipse(colour.x, colour.y, colour.rx, colour.ry)} Z`,
      hex: colour.hex,
      pixels: colours.length - index,
    })));

  const regions = buckets.flatMap((bucket, index) => bucket.paths.map((d, part) => ({
    id: `colour-${index + 1}-r${part + 1}`,
    label: 'Warna',
    d,
    suggestedColor: bucket.hex,
  })));
  buckets.forEach((bucket, index) => {
    const ids = regions.filter((region) => region.id.startsWith(`colour-${index + 1}-r`)).map((region) => region.id);
    if (ids.length === 0) return;
    steps.push({
      id: `color-${index + 1}`,
      phase: 'color' as const,
      instruction: ids.length > 1
        ? 'Warnai semua bagian warna ini.'
        : (index === 0 ? 'Warnai warna yang paling besar.' : 'Warnai warna ini.'),
      hint: `Warnai bagian ini dengan ${bucket.name}.`,
      guidePaths: [],
      colorRegionIds: ids,
      toolPreset: { tool: 'brush' as const, color: bucket.hex, widthViewbox: index === 0 ? 48 : 28 },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    });
  });

  return packageLesson({
    id: `doodle-${inkHash(ink)}`,
    title: 'Doodle dari foto',
    subtitle: 'Dari doodle',
    contentVersion: 'doodle-4',
    colorRegions: regions,
    steps,
  });
}

type PartName = 'head' | 'body' | 'arms' | 'legs' | 'top' | 'middle' | 'bottom';

const LIVING_ORDER: readonly PartName[] = ['head', 'body', 'arms', 'legs'];
const THING_ORDER: readonly PartName[] = ['top', 'middle', 'bottom'];

const PART_COPY: Record<PartName, { instruction: string; hint: string }> = {
  head: { instruction: 'Gambar kepalanya.', hint: 'Gambar kepalanya.' },
  body: { instruction: 'Gambar badannya.', hint: 'Gambar badannya.' },
  arms: { instruction: 'Gambar tangannya.', hint: 'Gambar tangannya.' },
  legs: { instruction: 'Gambar kakinya.', hint: 'Gambar kakinya.' },
  top: { instruction: 'Gambar bagian atas.', hint: 'Gambar bagian atas.' },
  middle: { instruction: 'Gambar bagian tengah.', hint: 'Gambar bagian tengah.' },
  bottom: { instruction: 'Gambar bagian bawah.', hint: 'Gambar bagian bawah.' },
};

interface DoodleStroke {
  readonly points: Array<[number, number]>;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly cx: number;
  readonly cy: number;
  readonly pixels: number;
  /** Label in the ink mask, so a tall stroke can be cut into body and legs. */
  readonly componentId: number;
  /** Set when a tall figure has already been cut into a named band. */
  readonly part?: PartName;
}

interface LinePart {
  readonly instruction: string;
  readonly hint: string;
  readonly chains: Array<Array<[number, number]>>;
}

/**
 * The doodle's own strokes, grouped into one step per part.
 *
 * Objects come from separate silhouettes. A living subject is one whose top
 * holds a roughly round blob, the head; ears and a tail join the part they
 * sit on. Anything else is split into top, middle, and bottom.
 */
function lineSections(doodle: RgbaImage): { hull: Array<[number, number]>; parts: LinePart[] } {
  const drawn = doodleStrokes(doodle);
  const strokes = drawn.strokes;
  const loops = subjectSilhouettes(doodle, 12).map((loop) => loop.map((point) => [point.x, point.y] as [number, number]));
  const groups = groupStrokes(strokes, loops, doodle);
  const order = groups
    .map((list, index) => ({ list, index, left: boxOf(list, loops[index]).minX }))
    .filter((group) => group.list.length > 0)
    .sort((a, b) => a.left - b.left || a.index - b.index);
  const parts: LinePart[] = [];
  for (const group of order) {
    const box = boxOf(group.list, loops[group.index]);
    const pieces = group.list.flatMap((stroke) => splitTall(doodle, drawn.labels, stroke) ?? [stroke]);
    const head = headStroke(pieces, box);
    const buckets = new Map<PartName, DoodleStroke[]>();
    const living = pieces.some((stroke) => stroke.part === 'head') || head !== null;
    for (const stroke of pieces) {
      const name = stroke.part ?? (living && head ? livingPart(stroke, head, box) : thingPart(stroke, box));
      const list = buckets.get(name) ?? [];
      list.push(stroke);
      buckets.set(name, list);
    }
    for (const name of living ? LIVING_ORDER : THING_ORDER) {
      const list = buckets.get(name);
      if (!list || list.length === 0) continue;
      list.sort((a, b) => a.minY - b.minY || a.minX - b.minX);
      const copy = PART_COPY[name];
      parts.push({ instruction: copy.instruction, hint: copy.hint, chains: list.map((stroke) => stroke.points) });
    }
  }
  const hullPoints = strokes.flatMap((stroke) => stroke.points);
  return { hull: convexHull(hullPoints), parts };
}

function boxOf(strokes: readonly DoodleStroke[], loop?: Array<[number, number]>): Bounds {
  const points = strokes.flatMap((stroke) => [[stroke.minX, stroke.minY], [stroke.maxX, stroke.maxY]] as Array<[number, number]>);
  if (loop) points.push(...loop);
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1])),
  };
}

/** The topmost large round stroke. A smaller ear above it does not take the name. */
function headStroke(strokes: readonly DoodleStroke[], box: Bounds): DoodleStroke | null {
  const height = Math.max(1, box.maxY - box.minY);
  const round = strokes.filter((stroke) => roughlyRound(stroke));
  if (round.length === 0) return null;
  const largest = round.reduce((best, stroke) => Math.max(best, Math.max(stroke.maxX - stroke.minX, stroke.maxY - stroke.minY)), 0);
  const candidates = round.filter((stroke) => {
    const size = Math.max(stroke.maxX - stroke.minX, stroke.maxY - stroke.minY);
    const inUpper = stroke.cy <= box.minY + height * 0.62;
    return inUpper && size >= largest * 0.6;
  });
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => a.minY - b.minY || b.pixels - a.pixels)[0] ?? null;
}

function roughlyRound(stroke: DoodleStroke): boolean {
  const width = Math.max(1, stroke.maxX - stroke.minX);
  const height = Math.max(1, stroke.maxY - stroke.minY);
  return Math.min(width, height) / Math.max(width, height) >= 0.62 && Math.max(width, height) >= 12;
}

/**
 * One connected figure still has to be drawn in parts.
 *
 * A round top with a body underneath is a living subject. A wide top is a
 * thing, split into top, middle, and bottom. A circle with nothing below it
 * stays whole, so a face is one head.
 */
function splitTall(doodle: RgbaImage, labels: Int32Array, stroke: DoodleStroke): DoodleStroke[] | null {
  const width = Math.max(1, stroke.maxX - stroke.minX);
  const height = stroke.maxY - stroke.minY;
  if (height < 48) return null;
  const topEnd = Math.round(stroke.minY + height * 0.4);
  const legStart = Math.round(stroke.minY + height * 0.68);
  const lowerStart = Math.round(stroke.minY + height * 0.55);
  let topMinX = stroke.maxX;
  let topMaxX = stroke.minX;
  let topMinY = stroke.maxY;
  let topMaxY = stroke.minY;
  let below = 0;
  for (let y = stroke.minY; y <= stroke.maxY; y += 1) {
    for (let x = stroke.minX; x <= stroke.maxX; x += 1) {
      if (labels[y * doodle.width + x] !== stroke.componentId) continue;
      if (y >= lowerStart) below += 1;
      if (y > topEnd) continue;
      if (x < topMinX) topMinX = x;
      if (x > topMaxX) topMaxX = x;
      if (y < topMinY) topMinY = y;
      if (y > topMaxY) topMaxY = y;
    }
  }
  // A thin leg is much less ink than the body it hangs from, and it still needs its own step.
  if (below < stroke.pixels * 0.12 || topMaxX < topMinX) return null;
  const topW = Math.max(1, topMaxX - topMinX);
  const topH = Math.max(1, topMaxY - topMinY);
  const topRound = Math.min(topW, topH) / Math.max(topW, topH) >= 0.55 && topW > width * 0.35;
  const topNarrow = topW < width * 0.75;
  if (width / height >= 0.75 && !(topRound && topNarrow)) return null;
  const names: readonly PartName[] = topRound ? ['head', 'body', 'legs'] : ['top', 'middle', 'bottom'];
  const bands: Array<[number, number]> = [
    [stroke.minY, topEnd],
    [topEnd + 1, legStart],
    [legStart + 1, stroke.maxY],
  ];
  const pieces: DoodleStroke[] = [];
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index]!;
    const name = names[index]!;
    for (const piece of sliceComponent(doodle, labels, stroke.componentId, band[0], band[1])) {
      const wide = piece.maxX - piece.minX > Math.max(1, piece.maxY - piece.minY) * 1.6;
      // A tail is a wide stroke in the lower band. It belongs with the body, not the feet.
      const part = name === 'legs' && wide ? 'body' : name;
      pieces.push({ ...piece, part });
    }
  }
  return pieces.length >= 2 ? pieces : null;
}

/** A torso that runs into the feet is one stroke. Cut it so the legs are their own step. */
function livingPart(stroke: DoodleStroke, head: DoodleStroke, box: Bounds): PartName {
  if (stroke === head || nearHead(stroke, head)) return 'head';
  const height = Math.max(1, box.maxY - box.minY);
  const width = Math.max(1, box.maxX - box.minX);
  const relY = (stroke.cy - box.minY) / height;
  const strokeW = Math.max(1, stroke.maxX - stroke.minX);
  const strokeH = Math.max(1, stroke.maxY - stroke.minY);
  if (strokeW > strokeH * 1.6) return 'body';
  const tall = strokeH > strokeW * 1.5;
  if (relY >= 0.62 || (tall && relY >= 0.48 && stroke.minY >= head.maxY)) return 'legs';
  const side = stroke.cx < box.minX + width * 0.22 || stroke.cx > box.maxX - width * 0.22;
  if (relY > 0.22 && relY < 0.72 && side && stroke.pixels < head.pixels) return 'arms';
  return 'body';
}

function nearHead(stroke: DoodleStroke, head: DoodleStroke): boolean {
  const pad = Math.max(head.maxX - head.minX, head.maxY - head.minY) * 0.4;
  const nearX = stroke.cx >= head.minX - pad && stroke.cx <= head.maxX + pad;
  const nearY = stroke.cy >= head.minY - pad && stroke.cy <= head.maxY + pad * 0.6;
  return nearX && nearY && stroke.pixels < head.pixels * 0.85;
}

function thingPart(stroke: DoodleStroke, box: Bounds): PartName {
  const height = Math.max(1, box.maxY - box.minY);
  const relY = (stroke.cy - box.minY) / height;
  if (relY < 0.34) return 'top';
  if (relY < 0.67) return 'middle';
  return 'bottom';
}

/**
 * Silhouettes seed the objects. A stroke that merely touches one — a body
 * drawn just under the head, a leg under the body — stays with that object.
 * A mark that touches nothing is its own object, unless it is a speck.
 */
function groupStrokes(
  strokes: readonly DoodleStroke[],
  loops: ReadonlyArray<Array<[number, number]>>,
  doodle: RgbaImage,
): DoodleStroke[][] {
  const touch = Math.max(8, Math.round(Math.min(doodle.width, doodle.height) * 0.035));
  const owner = strokes.map((stroke) => strokeOwner(stroke, loops));
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < strokes.length; index += 1) {
      if ((owner[index] ?? -1) >= 0) continue;
      for (let other = 0; other < strokes.length; other += 1) {
        const host = owner[other] ?? -1;
        if (host < 0 || strokeGap(strokes[index]!, strokes[other]!) > touch) continue;
        owner[index] = host;
        changed = true;
        break;
      }
    }
  }
  const groups = new Map<number, DoodleStroke[]>();
  const loose: DoodleStroke[] = [];
  strokes.forEach((stroke, index) => {
    const id = owner[index] ?? -1;
    if (id < 0) loose.push(stroke);
    else {
      const list = groups.get(id) ?? [];
      list.push(stroke);
      groups.set(id, list);
    }
  });
  for (const cluster of clusters(loose, touch)) {
      const pixels = cluster.reduce((sum, stroke) => sum + stroke.pixels, 0);
    const biggest = Math.max(...strokes.map((stroke) => stroke.pixels), 1);
    if (pixels < 80 || pixels < biggest * 0.2) continue;
    groups.set(groups.size + loops.length + 1, cluster);
  }
  return [...groups.values()];
}

function clusters(strokes: readonly DoodleStroke[], touch: number): DoodleStroke[][] {
  const parent = strokes.map((_, index) => index);
  const find = (index: number): number => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor] ?? cursor;
    return cursor;
  };
  for (let left = 0; left < strokes.length; left += 1) {
    for (let right = left + 1; right < strokes.length; right += 1) {
      if (strokeGap(strokes[left]!, strokes[right]!) > touch) continue;
      parent[find(right)] = find(left);
    }
  }
  const grouped = new Map<number, DoodleStroke[]>();
  strokes.forEach((stroke, index) => {
    const root = find(index);
    const list = grouped.get(root) ?? [];
    list.push(stroke);
    grouped.set(root, list);
  });
  return [...grouped.values()];
}

function strokeGap(left: DoodleStroke, right: DoodleStroke): number {
  const dx = Math.max(0, left.minX - right.maxX, right.minX - left.maxX);
  const dy = Math.max(0, left.minY - right.maxY, right.minY - left.maxY);
  return Math.hypot(dx, dy);
}

function strokeOwner(stroke: DoodleStroke, loops: ReadonlyArray<Array<[number, number]>>): number {
  if (loops.length === 0) return 0;
  for (let index = 0; index < loops.length; index += 1) {
    const loop = loops[index];
    if (loop && inside(stroke.cx, stroke.cy, loop)) return index;
  }
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < loops.length; index += 1) {
    const loop = loops[index];
    if (!loop) continue;
    for (const [x, y] of loop) {
      const distance = Math.hypot(stroke.cx - x, stroke.cy - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
  }
  const loop = loops[best];
  const reach = loop ? Math.max(24, (Math.max(...loop.map((point) => point[0])) - Math.min(...loop.map((point) => point[0]))) * 0.2) : 0;
  return bestDistance <= reach ? best : -1;
}

function doodleStrokes(doodle: RgbaImage): { strokes: DoodleStroke[]; labels: Int32Array } {
  const mask = inkMask(doodle);
  const labels = new Int32Array(mask.length);
  return { strokes: strokesInMask(doodle, mask, labels), labels };
}

function sliceComponent(doodle: RgbaImage, labels: Int32Array, id: number, y0: number, y1: number): DoodleStroke[] {
  const mask = new Uint8Array(labels.length);
  const top = Math.max(0, y0);
  const bottom = Math.min(doodle.height - 1, y1);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < doodle.width; x += 1) {
      const index = y * doodle.width + x;
      if (labels[index] === id) mask[index] = 1;
    }
  }
  return strokesInMask(doodle, mask, new Int32Array(mask.length));
}

function strokesInMask(doodle: RgbaImage, mask: Uint8Array, ids: Int32Array): DoodleStroke[] {
  const { width, height } = doodle;
  const stats: Array<{ id: number; pixels: number; minX: number; minY: number; maxX: number; maxY: number; sx: number; sy: number }> = [];
  let next = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || ids[start]) continue;
    next += 1;
    stack.push(start);
    ids[start] = next;
    let pixels = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let sx = 0;
    let sy = 0;
    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      pixels += 1;
      const x = index % width;
      const y = (index - x) / width;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      for (const [nx, ny] of neighbours(x, y, width, height)) {
        const neighbor = ny * width + nx;
        if (mask[neighbor] === 1 && !ids[neighbor]) {
          ids[neighbor] = next;
          stack.push(neighbor);
        }
      }
    }
    stats.push({ id: next, pixels, minX, minY, maxX, maxY, sx, sy });
  }
  const strokes: DoodleStroke[] = [];
  for (const stat of stats) {
    const points = traceStroke(doodle, ids, stat.id, stat.minX, stat.minY, stat.maxX, stat.maxY);
    if (!points || points.length < 4) continue;
    strokes.push({
      points,
      minX: stat.minX,
      minY: stat.minY,
      maxX: stat.maxX,
      maxY: stat.maxY,
      cx: stat.sx / stat.pixels,
      cy: stat.sy / stat.pixels,
      pixels: stat.pixels,
      componentId: stat.id,
    });
  }
  return strokes;
}

function traceStroke(
  doodle: RgbaImage,
  ids: Int32Array,
  id: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Array<[number, number]> | null {
  const pad = 2;
  const cropW = maxX - minX + 1 + pad * 2;
  const cropH = maxY - minY + 1 + pad * 2;
  if (cropW < 4 || cropH < 4) return null;
  const data = new Uint8Array(cropW * cropH * 4);
  data.fill(255);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (ids[y * doodle.width + x] !== id) continue;
      const index = ((y - minY + pad) * cropW + (x - minX + pad)) * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
    }
  }
  let traced;
  try {
    traced = traceInk({ width: cropW, height: cropH, data });
  } catch {
    return null;
  }
  const outer = traced.find((contour) => contour.silhouette) ?? traced[0];
  if (!outer || outer.points.length < 4) return null;
  return outer.points.map((point) => [point.x + minX - pad, point.y + minY - pad] as [number, number]);
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

/** A fill this dark on the whole body is a silhouette, not a colour. */
function isShadowHex(value: string): boolean {
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return false;
  return (r * 30 + g * 59 + b * 11) / 100 < 80;
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

/**
 * The drawing's enclosed areas, each holding the colour the photo has inside
 * it, mapped onto the lesson's paper.
 *
 * `regionsColouredBy` is the photo pipeline's flat colouring: a fill is closed
 * by construction, so a child painting one cannot run out of it, and white
 * areas stay white paper rather than becoming a colour.
 */
function filledRegions(
  doodle: RgbaImage,
  photo: RgbaImage,
  frame: TracePlacement,
  artScale: number,
): Array<{ d: string; hex: string; pixels: number }> {
  let found: readonly FlatRegion[];
  try {
    // Pale areas are kept here. In a photo of a white plush in a bright shop
    // they are most of the picture, and dropping them left the child three
    // things to colour.
    const strict = regionsColouredBy(doodle, photo, { keepPale: true }).regions;
    const painted = coverByColour(doodle, photo);
    // Open lines leave only a pocket or two closed. The photo's own colours
    // inside each subject cover the rest, so a body does not stay white.
    found = painted.regions.length > strict.length ? painted.regions : strict;
  } catch {
    return [];
  }
  const smallest = doodle.width * doodle.height * SMALLEST_REGION;
  return found
    .filter((region) => region.points.length >= 4 && region.pixels >= smallest)
    .sort((left, right) => right.pixels - left.pixels)
    .slice(0, MAX_COLOURS)
    .map((region) => ({
      hex: region.hex === '#ffffff' ? PAPER_WHITE : region.hex,
      pixels: region.pixels,
      d: pathFrom(
        region.points.map((point) => ({
          x: Math.round(frame.x + point.x * artScale),
          y: Math.round(frame.y + point.y * artScale),
        })),
        true,
      ),
    }))
    .filter((region) => region.d.length >= 8);
}

/** Areas that share a colour become one bucket, biggest total first. */
const CRAYONS: ReadonlyArray<{ name: string; r: number; g: number; b: number }> = [
  { name: 'kulit', r: 240, g: 184, b: 150 },
  { name: 'cokelat', r: 176, g: 112, b: 64 },
  { name: 'merah', r: 226, g: 59, b: 59 },
  { name: 'kuning', r: 240, g: 196, b: 58 },
  { name: 'hijau', r: 62, g: 154, b: 85 },
  { name: 'biru', r: 61, g: 116, b: 214 },
  { name: 'hitam', r: 58, g: 58, b: 58 },
  { name: 'abu-abu', r: 150, g: 150, b: 158 },
  { name: 'merah muda', r: 242, g: 166, b: 179 },
  { name: 'ungu', r: 122, g: 90, b: 170 },
];

/** Share of the subject interior that receives a colour. The page outside stays out. */
export function doodleInteriorCoverage(doodle: RgbaImage, photo: RgbaImage): number {
  try {
    return coverByColour(doodle, photo).coverage;
  } catch {
    return 0;
  }
}

function colourBuckets(
  areas: ReadonlyArray<{ d: string; hex: string; pixels: number }>,
): Array<{ name: string; hex: string; paths: string[]; pixels: number }> {
  const tagged = areas.map((area) => ({ ...area, crayon: crayonFor(area.hex) }));
  const areaOf = (name: string) => tagged.filter((area) => area.crayon.name === name)
    .reduce((sum, area) => sum + area.pixels, 0);
  let names = [...new Set(tagged.map((area) => area.crayon.name))];
  while (names.length > 6) {
    const ranked = [...names].sort((left, right) => areaOf(left) - areaOf(right));
    const small = ranked[0]!;
    const from = tagged.find((area) => area.crayon.name === small)?.crayon ?? CRAYONS[0]!;
    const host = ranked.slice(1).reduce((best, name) => {
      const swatch = CRAYONS.find((item) => item.name === name) ?? from;
      const distance = (swatch.r - from.r) ** 2 + (swatch.g - from.g) ** 2 + (swatch.b - from.b) ** 2;
      return distance < best.distance ? { name, distance } : best;
    }, { name: ranked[1]!, distance: Number.POSITIVE_INFINITY });
    const next = CRAYONS.find((item) => item.name === host.name) ?? from;
    for (const area of tagged) {
      if (area.crayon.name === small) area.crayon = next;
    }
    names = [...new Set(tagged.map((area) => area.crayon.name))];
  }
  return names.map((name) => {
    const members = tagged.filter((area) => area.crayon.name === name);
    const crayon = members[0]?.crayon ?? CRAYONS[0]!;
    return {
      name: crayon.name,
      hex: crayon.name === 'putih' ? PAPER_WHITE : hex(crayon.r, crayon.g, crayon.b),
      pixels: members.reduce((sum, area) => sum + area.pixels, 0),
      paths: members.map((area) => area.d),
    };
  }).sort((left, right) => right.pixels - left.pixels);
}

function crayonFor(value: string): { name: string; r: number; g: number; b: number } {
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  const lum = (r * 30 + g * 59 + b * 11) / 100;
  const max = Math.max(r, g, b);
  const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  if (lum >= 215 && sat < 0.18) return { name: 'putih', r: 234, g: 229, b: 218 };
  let best = CRAYONS[0]!;
  let gap = Number.POSITIVE_INFINITY;
  for (const swatch of CRAYONS) {
    const distance = (swatch.r - r) ** 2 + (swatch.g - g) ** 2 + (swatch.b - b) ** 2;
    if (distance < gap) {
      gap = distance;
      best = swatch;
    }
  }
  return best;
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
  frame: TracePlacement,
  scale: number,
): SubjectColour[] {
  const samples: Array<{ r: number; g: number; b: number; x: number; y: number }> = [];
  const step = Math.max(1, Math.floor(Math.max(width, height) / 80));
  const sample = photoSampler(width, height, photo);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (ink[y * width + x] === 1) continue;
      if (!inside(x, y, hull)) continue;
      const colour = sample(x, y);
      if (!colour) continue;
      samples.push({ ...colour, x, y });
    }
  }
  const corners = cornerColours(photo);
  // Samples come from inside the traced outline, so background that leaks in
  // is a thin margin. A colour matching the photo's corners across more than
  // a third of the subject is therefore the subject -- a white plush in a
  // bright shop, a grey cat on a pale floor -- and not the room behind it.
  const matching = samples.filter((sample) => nearCorner(sample, corners)).length;
  const interior = matching < samples.length * 0.35
    ? samples.filter((sample) => !nearCorner(sample, corners))
    : samples;
  // No saturation bar. A white plush, a white shirt, a grey cat: dropping
  // every pale sample left the subject with only its one bright patch, and
  // that colour then stood for the whole body. kidHex still maps a pale or
  // dark cluster onto the children's palette.
  const chosen = (interior.length >= 12 ? interior : samples).slice(0, 4000);
  if (chosen.length === 0) {
    return [{ hex: '#f0c43a', x: 500, y: 375, rx: 80, ry: 60 }];
  }
  const clustered = kMeans(chosen, Math.min(6, Math.max(1, Math.floor(chosen.length / 30))));
  const total = clustered.reduce((sum, center) => sum + center.n, 0) || 1;
  const centers = distinctColours(clustered.filter((center, index) => index === 0 || center.n >= total * 0.06));
  return centers.slice(0, MAX_COLOURS).map((center) => {
    const at = toSpace([center.x, center.y], frame, scale);
    // The patch covers where that colour sits. A fixed ellipse floated over
    // the middle of the drawing whatever the colour belonged to.
    return {
      hex: kidHex(center),
      x: at.x,
      y: at.y,
      rx: patchRadius(center.sx, scale),
      ry: patchRadius(center.sy, scale),
    };
  });
}

/**
 * Doodle coordinate to photo coordinate.
 *
 * The doodle is asked for the photo's own aspect ratio, but a generator
 * rounds its canvas, so the two frames can still differ a little. Reading the
 * photo at the doodle's raw coordinates then walks off the subject and picks
 * the colour of whatever is beside it. The shared area is centred, so the
 * longer relative axis is scaled about the middle instead of stretched.
 */
export function photoSampler(
  width: number,
  height: number,
  photo: RgbaImage,
): (x: number, y: number) => { r: number; g: number; b: number } | null {
  const doodleRatio = width / Math.max(1, height);
  const photoRatio = photo.width / Math.max(1, photo.height);
  const wider = photoRatio > doodleRatio;
  const sx = wider ? doodleRatio / photoRatio : 1;
  const sy = wider ? 1 : photoRatio / doodleRatio;
  return (x, y) => pixel(
    photo,
    0.5 + (x / width - 0.5) * sx,
    0.5 + (y / height - 0.5) * sy,
  );
}


/** Wide enough to be worth filling, never so wide it swallows the drawing. */
function patchRadius(spread: number, scale: number): number {
  return Math.round(Math.min(220, Math.max(30, spread * 1.5 * scale)));
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

function distinctColours<T extends { r: number; g: number; b: number }>(centers: T[]): T[] {
  const kept: T[] = [];
  for (const center of centers) {
    const similar = kept.find((other) => (
      (other.r - center.r) ** 2 + (other.g - center.g) ** 2 + (other.b - center.b) ** 2 < 32 * 32
    ));
    if (!similar) kept.push(center);
  }
  return kept;
}

function kMeans(
  samples: Array<{ r: number; g: number; b: number; x: number; y: number }>,
  k: number,
): Array<{ r: number; g: number; b: number; x: number; y: number; n: number; sx: number; sy: number }> {
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
    .map((center, index) => ({ ...center, ...spreadOf(groups[index] ?? [], center) }))
    .filter((center) => center.n > 0)
    .sort((a, b) => b.n - a.n);
}

/** How far that colour reaches across the drawing, as a standard deviation. */
function spreadOf(
  group: ReadonlyArray<{ x: number; y: number }>,
  center: { x: number; y: number },
): { n: number; sx: number; sy: number } {
  if (group.length === 0) return { n: 0, sx: 0, sy: 0 };
  let dx = 0;
  let dy = 0;
  for (const sample of group) {
    dx += (sample.x - center.x) ** 2;
    dy += (sample.y - center.y) ** 2;
  }
  return {
    n: group.length,
    sx: Math.sqrt(dx / group.length),
    sy: Math.sqrt(dy / group.length),
  };
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

/**
 * Drawing pixel to lesson space.
 *
 * `fitPhoto` is what puts the doodle on the paper when the child traces, so
 * the guides have to use that same placement. Fitting the ink's bounding box
 * instead magnified every guide by the drawing's own margin, and the outline
 * came out larger than the picture under it.
 */
function toSpace(point: [number, number], frame: TracePlacement, scale: number): { x: number; y: number } {
  return {
    x: Math.round(frame.x + point[0] * scale),
    y: Math.round(frame.y + point[1] * scale),
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
