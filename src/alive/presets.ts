/**
 * Per-lesson motion, keyed by the step and the colour region the child painted.
 *
 * A lesson with no preset replays the strokes in the order they were drawn,
 * then gives the whole picture a soft bounce. The reference drawing is never
 * an input.
 */

import type { CoordinateSpace } from '../lesson-data/schema';
import {
  identityAt,
  strokeRevealed,
  transformAt,
  type AlivePoint,
  type MotionKind,
  type Transform2D,
} from './motion';

export interface AliveStroke {
  readonly stepId: string;
  readonly points: readonly AlivePoint[];
  readonly color: string;
  readonly width: number;
  readonly layer: 'ink' | 'color';
  readonly erase: boolean;
  readonly sequence: number;
  readonly clipRegionIds: readonly string[];
}

interface MotionRule {
  readonly pattern: RegExp;
  readonly motion: MotionKind;
}

interface LessonPreset {
  readonly whole?: MotionKind;
  readonly rules: readonly MotionRule[];
}

const PRESETS: Readonly<Record<string, LessonPreset>> = {
  cat: { rules: [rule(/tail/, 'wag'), rule(/face|eye|whisker/, 'blink')] },
  'cat-sitting': { rules: [rule(/tail/, 'wag'), rule(/face|eye|whisker/, 'blink')] },
  dog: { rules: [rule(/tail/, 'wag'), rule(/face|eye/, 'blink')] },
  fish: { whole: 'swim', rules: [rule(/tail|fin/, 'sway')] },
  'fish-cheerful': { whole: 'swim', rules: [rule(/tail|fin/, 'sway')] },
  'sun-smiling': { rules: [rule(/ray/, 'spin'), rule(/eye/, 'blink')] },
  flower: { rules: [rule(/petal/, 'sway'), rule(/leaf/, 'sway')] },
  'flower-cheerful': { rules: [rule(/petal/, 'sway'), rule(/leaf/, 'sway')] },
  'house-front': { rules: [rule(/chimney/, 'bob')] },
  house: { rules: [rule(/chimney/, 'bob')] },
  'butterfly-front': { rules: [rule(/wing/, 'flap')] },
  butterfly: { rules: [rule(/wing/, 'flap')] },
  bird: { rules: [rule(/wing/, 'flap'), rule(/tail/, 'sway')] },
  cup: { rules: [rule(/steam/, 'bob')] },
};

function rule(pattern: RegExp, motion: MotionKind): MotionRule {
  return { pattern, motion };
}

export interface AlivePuff {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly alpha: number;
  readonly color: string;
}

export interface AliveSparkle {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly color: string;
}

export interface AliveDraw {
  readonly stroke: AliveStroke;
  readonly visible: boolean;
  readonly transform: Transform2D;
}

export interface AliveFrame {
  readonly mode: 'parts' | 'redraw';
  readonly whole: Transform2D;
  readonly draws: readonly AliveDraw[];
  readonly puffs: readonly AlivePuff[];
  readonly sparkles: readonly AliveSparkle[];
}

const SPACE_CENTER = (space: CoordinateSpace): AlivePoint => ({ x: space.width / 2, y: space.height / 2 });

export function frameAt(lessonId: string, space: CoordinateSpace, strokes: readonly AliveStroke[], t: number): AliveFrame {
  const preset = PRESETS[lessonId];
  const ordered = [...strokes].sort((left, right) => left.sequence - right.sequence);
  if (!preset) return redrawFrame(space, ordered, t);

  const tagged = ordered.map((stroke) => ({ stroke, motion: motionFor(stroke, preset) }));
  const anyPart = tagged.some((item) => item.motion !== 'still');
  const wholeMotion: MotionKind = preset.whole ?? (anyPart ? 'still' : 'bounce');
  const draws = tagged.map(({ stroke, motion }) => ({
    stroke,
    visible: true,
    transform: transformAt(motion, t, pivotFor(stroke, motion, space), space),
  }));
  return {
    mode: 'parts',
    whole: transformAt(wholeMotion, t, SPACE_CENTER(space), space),
    draws,
    puffs: puffsFor(draws, t),
    sparkles: [],
  };
}

function redrawFrame(space: CoordinateSpace, strokes: readonly AliveStroke[], t: number): AliveFrame {
  return {
    mode: 'redraw',
    whole: transformAt('bounce', t, SPACE_CENTER(space), space),
    draws: strokes.map((stroke, index) => ({
      stroke,
      visible: strokeRevealed(index, strokes.length, t),
      transform: identityAt(centroid(stroke.points)),
    })),
    puffs: [],
    sparkles: sparklesFor(strokes, t),
  };
}

function motionFor(stroke: AliveStroke, preset: LessonPreset): MotionKind {
  for (const item of preset.rules) {
    if (item.pattern.test(stroke.stepId)) return item.motion;
    const only = stroke.clipRegionIds.length === 1 ? stroke.clipRegionIds[0] : undefined;
    if (only && item.pattern.test(only)) return item.motion;
  }
  return 'still';
}

function pivotFor(stroke: AliveStroke, motion: MotionKind, space: CoordinateSpace): AlivePoint {
  if (motion === 'spin' || motion === 'swim' || motion === 'bounce') return SPACE_CENTER(space);
  const box = bounds(stroke.points);
  if (motion === 'wag') {
    return { x: box.cx < space.width / 2 ? box.maxX : box.minX, y: box.cy };
  }
  return { x: box.cx, y: box.cy };
}

function puffsFor(draws: readonly AliveDraw[], t: number): AlivePuff[] {
  const source = draws.find((draw) => {
    if (draw.stroke.erase || draw.stroke.points.length === 0) return false;
    return draw.stroke.stepId.includes('chimney') || draw.stroke.clipRegionIds.includes('chimney');
  });
  if (!source) return [];
  const box = bounds(source.stroke.points);
  return [0, 1, 2].map((index) => ({
    x: box.cx,
    y: box.minY - (t * 90 + index * 22),
    radius: 8 + index * 5,
    alpha: Math.max(0, 1 - t) * (1 - index * 0.22),
    color: source.stroke.color,
  }));
}

function sparklesFor(strokes: readonly AliveStroke[], t: number): AliveSparkle[] {
  const ink = strokes.find((stroke) => !stroke.erase && stroke.points.length > 0);
  if (!ink) return [];
  return ink.points.filter((_, index) => index % 3 === 0).slice(0, 5).map((point, index) => ({
    x: point.x,
    y: point.y - 12,
    alpha: Math.max(0, Math.sin((t + index * 0.17) * Math.PI * 2)),
    color: ink.color,
  }));
}

function centroid(points: readonly AlivePoint[]): AlivePoint {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function bounds(points: readonly AlivePoint[]): { minX: number; minY: number; maxX: number; maxY: number; cx: number; cy: number } {
  const first = points[0];
  if (!first) return { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0 };
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
