/**
 * Turns a line doodle and the original photo into a short lesson.
 *
 * Step 1 is the biggest subject's own outline. A second figure standing
 * beside it is the next step, not part of the same blob. Colour steps fill
 * the areas inside those outlines, including where a line does not quite close.
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
// The owner asked for detail over brevity: more steps are welcome as long as
// the drawing and the colours match the photo.
const MAX_PARTS = 8;
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
  const subjects = subjectSilhouettes(doodle).map((loop) => loop.map((point) => (
    [point.x * (width / Math.max(1, doodle.width)), point.y * (height / Math.max(1, doodle.height))] as [number, number]
  )));
  const split = subjects.length >= 2;
  const traced = tracedContours(doodle, width, height, split ? subjects : undefined);
  const hull = (split ? subjects[0] : traced?.outline) ?? convexHull(sampleInk(ink, width, bounds));
  if (hull.length < 3) throw new Error('Doodle-nya terlalu kosong.');

  const parts = groupChains(traced?.interiors ?? [], bounds);
  // The areas the drawing already encloses, each taking the colour the photo
  // has inside it. A handful of ellipses over the middle of the page could
  // never match a photo, whatever colours went into them.
  const artScale = frame.width / Math.max(1, doodle.width);
  const filled = filledRegions(doodle, photo, frame, artScale);
  const colours = filled.length > 0 ? [] : subjectColours(width, height, photo, ink, hull, frame, scale);

  const shape = pathFrom(hull.map((point) => toSpace(point, frame, scale)), true);
  const guides: GuidePath[] = [{ id: 'shape', d: shape, role: 'final-outline' }];
  const steps: LessonStep[] = [
    outlineStep('shape', 'Gambar bentuk besarnya.', 'Mulai dari bentuk yang paling besar.', guides),
  ];
  subjects.slice(1).forEach((loop, index) => {
    const d = pathFrom(loop.map((point) => toSpace(point, frame, scale)), true);
    if (d.length < 8) return;
    steps.push(outlineStep(
      `subject-${index + 2}`,
      'Gambar bentuk yang lain.',
      'Benda yang lain, di sampingnya.',
      [{ id: `subject-${index + 2}`, d, role: 'final-outline' }],
    ));
  });
  parts.forEach((part, index) => {
    const guidePaths: GuidePath[] = [];
    part.forEach((chain, chainIndex) => {
      const d = pathFrom(chain.map((point) => toSpace(point, frame, scale)), false);
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
    contentVersion: 'doodle-3',
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

/**
 * The drawing's own contours, in the downscaled mask's grid.
 *
 * `traceInk` runs marching squares on the full-resolution doodle: the outer
 * loop is the subject's real boundary, and the rest are the lines inside it --
 * eyes, a nose, an ear's fold. Returns null when the drawing is too thin or
 * too broken for a closed loop, and the caller falls back to the hull.
 */
function tracedContours(
  doodle: RgbaImage,
  width: number,
  height: number,
  subjects?: ReadonlyArray<Array<[number, number]>>,
): { outline: Array<[number, number]>; interiors: Array<Array<[number, number]>> } | null {
  let contours;
  try {
    contours = traceInk(doodle);
  } catch {
    return null;
  }
  const silhouette = contours.find((contour) => contour.silhouette === true)
    ?? [...contours].filter((contour) => contour.closed)
      .sort((left, right) => right.points.length - left.points.length)[0];
  if (!silhouette || silhouette.points.length < 3) return null;
  // A plain scale, so the points stay fractional until toSpace rounds them.
  const sx = width / Math.max(1, doodle.width);
  const sy = height / Math.max(1, doodle.height);
  const map = (contour: typeof silhouette): Array<[number, number]> =>
    contour.points.map((point) => [point.x * sx, point.y * sy] as [number, number]);
  const outline = map(silhouette);
  if (outline.length < 3) return null;
  // Only lines on the subject. A speck of background that survived the mask
  // traces its own loop, and it is not a part of anything the child is drawing.
  const interiors = contours
    .filter((contour) => contour !== silhouette)
    .map(map)
    .filter((chain) => chain.length >= 3)
    .filter((chain) => {
      const centre = chainCentroid(chain);
      const homes = subjects && subjects.length > 0 ? subjects : [outline];
      return homes.some((home) => inside(centre.x, centre.y, home));
    });
  return { outline, interiors };
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
 * Lines that sit together become one part. The radius is small, so a face is
 * a step and not the whole figure: the owner asked for detail, and MAX_PARTS
 * is the only thing that caps how many steps a busy drawing earns.
 */
function groupChains(
  chains: ReadonlyArray<Array<[number, number]>>,
  bounds: Bounds,
): Array<Array<Array<[number, number]>>> {
  const spans = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  const anchors: Array<{ chains: Array<Array<[number, number]>>; weight: number; cx: number; cy: number }> = [];
  const ordered = [...chains].sort((a, b) => b.length - a.length);
  for (const chain of ordered) {
    const center = chainCentroid(chain);
    const near = anchors.find((anchor) => Math.hypot(anchor.cx - center.x, anchor.cy - center.y) < spans * 0.07);
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
