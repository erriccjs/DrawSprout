/**
 * Cross-layer behaviour that only shows up when the engine and the renderer are
 * driven together: what actually reaches the canvas after an undo, which layer
 * an eraser cuts, and when a colour boundary applies.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import { createSession, reduceSession } from '../lesson-engine/session';
import type { SessionAction, SessionState } from '../lesson-engine/types';
import { clipPathsFromLesson, toRenderStrokes } from '../ui/render-adapter';
import { renderArtworkToCanvas } from './export';
import {
  createRecordingCanvas,
  resetConstructedPathData,
  type RecordedCall,
  type RecordingCanvas,
} from '../test/fake-canvas';
import type { CanvasFactory } from './types';

const space = CAT_LESSON.coordinateSpace;
const clipPaths = clipPathsFromLesson(CAT_LESSON);

function apply(state: SessionState, actions: readonly SessionAction[]): SessionState {
  return actions.reduce((current, action) => reduceSession(CAT_LESSON, current, action), state);
}

let strokeN = 0;

function stroke(stepId: string, extra: Record<string, unknown> = {}) {
  strokeN += 1;
  return {
    type: 'commit-stroke' as const,
    stroke: {
      id: `s${strokeN}`,
      stepId,
      layerId: 'ink' as const,
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
      color: '#3a3a3a',
      width: 8,
      tool: 'pen' as const,
      clipRegionIds: [] as readonly string[],
      ...extra,
    },
  };
}

function render(state: SessionState) {
  const recordings: RecordingCanvas[] = [];
  const factory: CanvasFactory = (w, h) => {
    const recording = createRecordingCanvas(w, h);
    recordings.push(recording);
    return recording.canvas;
  };
  renderArtworkToCanvas({
    space,
    strokes: toRenderStrokes(state.strokes),
    clipPaths,
    pixelWidth: 1000,
    createCanvas: factory,
  });
  const [color, ink] = recordings;
  const count = (c: RecordingCanvas, op: string) =>
    c.calls.filter((call: RecordedCall) => call.op === op).length;
  return { color: color!, ink: ink!, count };
}

beforeEach(() => {
  resetConstructedPathData();
});

describe('undo reaches the exported image', () => {
  it('leaves an undone stroke out, and brings it back on redo', () => {
    const drawn = apply(createSession(CAT_LESSON, 'u1'), [
      stroke('head-outline'),
      stroke('head-outline'),
    ]);
    expect(render(drawn).count(render(drawn).ink, 'stroke')).toBe(2);

    const undone = reduceSession(CAT_LESSON, drawn, { type: 'undo' });
    const afterUndo = render(undone);
    expect(afterUndo.count(afterUndo.ink, 'stroke')).toBe(1);

    const redone = reduceSession(CAT_LESSON, undone, { type: 'redo' });
    const afterRedo = render(redone);
    expect(afterRedo.count(afterRedo.ink, 'stroke')).toBe(2);
  });
});

describe('the eraser cuts the layer it is used on', () => {
  it('erases paint on a colour step without touching the ink layer', () => {
    const state = apply(createSession(CAT_LESSON, 'e1'), [
      stroke('head-outline'),
      stroke('color-fur', { layerId: 'color', tool: 'brush', color: '#e8a33d', width: 48 }),
      stroke('color-fur', { layerId: 'color', tool: 'eraser', width: 60 }),
    ]);

    const { color, ink, count } = render(state);
    // One line on ink, paint plus the erase pass on colour.
    expect(count(ink, 'stroke')).toBe(1);
    expect(count(color, 'stroke')).toBe(2);

    const colorModes = color.calls
      .filter((call) => call.op === 'set:globalCompositeOperation')
      .map((call) => call.args[0]);
    expect(colorModes).toContain('destination-out');

    const inkModes = ink.calls
      .filter((call) => call.op === 'set:globalCompositeOperation')
      .map((call) => call.args[0]);
    expect(inkModes).not.toContain('destination-out');
  });
});

describe('the colour boundary applies per stroke', () => {
  it('keeps an earlier clipped stroke clipped after the assist is switched off', () => {
    const colorIndex = CAT_LESSON.steps.findIndex((step) => step.id === 'color-fur');
    const onColorStep = apply(
      createSession(CAT_LESSON, 'c1'),
      Array.from({ length: colorIndex }, () => ({ type: 'next-step' }) as const),
    );

    const clipped = apply(onColorStep, [
      stroke('color-fur', {
        layerId: 'color',
        tool: 'brush',
        clipRegionIds: CAT_LESSON.steps[colorIndex]!.colorRegionIds,
      }),
    ]);
    const unclipped = apply(clipped, [
      { type: 'set-boundary-assist', enabled: false },
      stroke('color-fur', { layerId: 'color', tool: 'brush', clipRegionIds: [] }),
    ]);

    const { color, count } = render(unclipped);
    const regions = CAT_LESSON.steps[colorIndex]!.colorRegionIds.length;
    expect(regions).toBeGreaterThan(1);

    // The first stroke is still drawn once per region; the second is drawn once,
    // unconstrained. Switching the assist off never repaints earlier work.
    expect(count(color, 'clip')).toBe(regions);
    expect(count(color, 'stroke')).toBe(regions + 1);
  });
});
