/**
 * Layer compositing, clipping and the live-stroke path.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ArtworkSurface } from './artwork-surface';
import { fitViewport } from './coordinates';
import {
  createRecordingCanvas,
  resetConstructedPathData,
  type RecordedCall,
  type RecordingCanvas,
} from '../test/fake-canvas';
import type { CanvasFactory, RenderStroke, Viewport } from './types';

const space = { width: 1000, height: 750 };
const viewport: Viewport = fitViewport(space, 1000, 750, 1);

function harness() {
  const recordings: RecordingCanvas[] = [];
  const factory: CanvasFactory = (widthPx, heightPx) => {
    const recording = createRecordingCanvas(widthPx, heightPx);
    recordings.push(recording);
    return recording.canvas;
  };
  const surface = new ArtworkSurface(space, viewport, factory);
  // Layers are created in composite order: colour first, ink on top.
  return { surface, color: recordings[0]!, ink: recordings[1]!, recordings };
}

const stroke: RenderStroke = {
  points: [
    { x: 10, y: 10 },
    { x: 20, y: 20 },
  ],
  color: '#3a3a3a',
  width: 6,
  layer: 'ink',
  erase: false,
  clipPathIds: [],
};

beforeEach(() => {
  resetConstructedPathData();
});

function ops(calls: readonly RecordedCall[], op: string): RecordedCall[] {
  return calls.filter((call) => call.op === op);
}

describe('replay', () => {
  it('clears both layers before redrawing', () => {
    const { surface, color, ink } = harness();
    surface.replay([stroke]);
    expect(ops(color.calls, 'clearRect')).toHaveLength(1);
    expect(ops(ink.calls, 'clearRect')).toHaveLength(1);
  });

  it('sends each stroke to its own layer', () => {
    const { surface, color, ink } = harness();
    surface.replay([stroke, { ...stroke, layer: 'color' }]);
    expect(ops(ink.calls, 'stroke')).toHaveLength(1);
    expect(ops(color.calls, 'stroke')).toHaveLength(1);
  });

  it('cuts a free-drawing eraser out of both layers', () => {
    const { surface, color, ink } = harness();
    surface.replay([{ ...stroke, erase: true, eraseAll: true, layer: 'ink' }]);
    expect(ink.calls.some((call) => call.op === 'stroke')).toBe(true);
    expect(color.calls.some((call) => call.op === 'stroke')).toBe(true);
  });

  it('cuts an eraser stroke out of its layer instead of painting over it', () => {
    const { surface, ink } = harness();
    surface.replay([{ ...stroke, erase: true }]);
    // `destination-out` means an erased area goes back to transparent, so the
    // colour layer underneath shows through rather than being covered in paper
    // colour.
    expect(ink.calls.some((call) => call.op === 'stroke')).toBe(true);
    expect(ink.canvas.getContext('2d')!.globalCompositeOperation).toBe('destination-out');
  });
});

describe('clipping', () => {
  it('draws once per clip region, so overlapping regions behave as a union', () => {
    const { surface, color } = harness();
    surface.setClipPaths({ a: 'M 0 0 L 10 0 L 10 10 Z', b: 'M 5 5 L 20 5 L 20 20 Z' });
    surface.replay([{ ...stroke, layer: 'color', clipPathIds: ['a', 'b'] }]);

    // Canvas `clip()` intersects, so a union is produced by repeating the draw
    // under each region. Opaque paint makes the overlap pixel-identical.
    expect(ops(color.calls, 'clip')).toHaveLength(2);
    expect(ops(color.calls, 'stroke')).toHaveLength(2);
    expect(ops(color.calls, 'save')).toHaveLength(2);
    expect(ops(color.calls, 'restore')).toHaveLength(2);
  });

  it('ignores a clip id that the lesson does not define', () => {
    const { surface, color } = harness();
    surface.setClipPaths({ a: 'M 0 0 L 10 0 L 10 10 Z' });
    surface.replay([{ ...stroke, layer: 'color', clipPathIds: ['a', 'missing'] }]);
    expect(ops(color.calls, 'clip')).toHaveLength(1);
  });

  it('draws unconstrained when the stroke has no clip regions', () => {
    const { surface, ink } = harness();
    surface.replay([stroke]);
    expect(ops(ink.calls, 'clip')).toEqual([]);
    expect(ops(ink.calls, 'stroke')).toHaveLength(1);
  });
});

describe('live stroke', () => {
  it('paints a dot on pointer-down so a tap is visible immediately', () => {
    const { surface, ink } = harness();
    surface.beginStroke(stroke, { x: 5, y: 5 });
    expect(ops(ink.calls, 'arc')).toHaveLength(1);
    expect(surface.hasLiveStroke()).toBe(true);
  });

  it('paints only the newest segment as the stroke grows', () => {
    const { surface, ink } = harness();
    surface.beginStroke(stroke, { x: 0, y: 0 });
    const before = ops(ink.calls, 'lineTo').length;

    surface.extendStroke({ x: 10, y: 0 });
    surface.extendStroke({ x: 20, y: 0 });

    // Two moves, two one-segment draws: the cost of a pointermove does not grow
    // with the length of the stroke.
    expect(ops(ink.calls, 'lineTo')).toHaveLength(before + 2);
    expect(ops(ink.calls, 'stroke')).toHaveLength(2);
  });

  it('returns every sample when the stroke ends and then forgets it', () => {
    const { surface } = harness();
    surface.beginStroke(stroke, { x: 0, y: 0 });
    surface.extendStroke({ x: 10, y: 5 });

    expect(surface.endStroke()).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 5 },
    ]);
    // Forgotten, so the next pointer-down cannot be joined to this stroke
    // (AT-17).
    expect(surface.hasLiveStroke()).toBe(false);
    expect(surface.endStroke()).toBeNull();
  });

  it('does nothing when a sample arrives with no live stroke', () => {
    const { surface, ink } = harness();
    const before = ink.calls.length;
    surface.extendStroke({ x: 1, y: 1 });
    expect(ink.calls).toHaveLength(before);
  });
});

describe('resize', () => {
  it('replays the committed strokes at the new scale (AT-06)', () => {
    const { surface, ink } = harness();
    surface.replay([stroke]);
    const drawnBefore = ops(ink.calls, 'stroke').length;

    surface.resize(fitViewport(space, 800, 600, 1));

    // Same stroke, drawn again from the stored coordinates at the new scale.
    expect(ops(ink.calls, 'stroke')).toHaveLength(drawnBefore + 1);
    const transforms = ops(ink.calls, 'setTransform');
    expect(transforms.at(-1)!.args[0]).toBeCloseTo(0.8, 5);
  });

  it('keeps a stroke that is still being drawn, and keeps extending it', () => {
    const { surface, ink } = harness();
    surface.beginStroke(stroke, { x: 0, y: 0 });
    surface.extendStroke({ x: 10, y: 0 });

    surface.resize(fitViewport(space, 800, 600, 1));

    // The pointer is still down, so the samples so far are repainted at the new
    // scale rather than wiped, and the rest of the stroke still has something
    // to extend.
    expect(surface.hasLiveStroke()).toBe(true);
    const afterResize = ops(ink.calls, 'stroke').length;
    surface.extendStroke({ x: 20, y: 0 });
    expect(ops(ink.calls, 'stroke')).toHaveLength(afterResize + 1);
    expect(surface.endStroke()).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]);
  });

  it('skips the work when the backing store size has not changed', () => {
    const { surface, ink } = harness();
    surface.replay([stroke]);
    const before = ink.calls.length;

    // Half the CSS size at twice the pixel ratio is the same backing store, so
    // there is nothing to reallocate or repaint.
    surface.resize(fitViewport(space, 500, 375, 2));
    expect(ink.calls).toHaveLength(before);
  });
});

describe('compositing', () => {
  it('paints colour then ink onto the target', () => {
    const { surface, color, ink } = harness();
    const target = createRecordingCanvas(1000, 750);
    surface.compositeTo(target.canvas.getContext('2d')!);

    expect(ops(target.calls, 'drawImage').map((call) => call.args[0])).toEqual([
      color.canvas,
      ink.canvas,
    ]);
  });
});
