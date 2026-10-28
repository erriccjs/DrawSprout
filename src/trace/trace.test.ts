import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../lesson-data';
import { renderArtworkToCanvas, type ExportUnderlay } from '../renderer/export';
import { createRecordingCanvas, type RecordingCanvas } from '../test/fake-canvas';
import { TRACE_LESSON } from './lesson';
import { paintTracePhoto } from './paint';
import { fitPhoto, movePhoto, scalePhoto } from './placement';

describe('tracing photo placement', () => {
  it('fits a wide photo inside the paper and keeps the aspect ratio', () => {
    const placed = fitPhoto(1000, 750, 2000, 1000);
    expect(placed.width / placed.height).toBeCloseTo(2);
    expect(placed.x).toBeGreaterThanOrEqual(24);
    expect(placed.y).toBeGreaterThanOrEqual(24);
    expect(placed.x + placed.width).toBeLessThanOrEqual(1000 - 24);
  });

  it('lets the photo be moved and scaled without stretching it', () => {
    const fitted = fitPhoto(1000, 750, 400, 300);
    const moved = movePhoto(fitted, 50, -20, 1000, 750);
    expect(moved.width).toBe(fitted.width);
    expect(moved.x).toBeCloseTo(fitted.x + 50);
    const scaled = scalePhoto(fitted, 1.25, 1000, 750);
    expect(scaled.width / scaled.height).toBeCloseTo(fitted.width / fitted.height);
    expect(scaled.width).toBeGreaterThan(fitted.width);
  });

  it('is a valid blank lesson and the export can leave the photo out or put it underneath', () => {
    expect(() => assertValidLessons([TRACE_LESSON])).not.toThrow();
    const image = createRecordingCanvas(4, 4).canvas;
    const placed = fitPhoto(1000, 750, 4, 4);
    const plain = renderPaper();
    expect(plain.at(-1)?.calls.some((call) => call.op === 'drawImage' && call.args[1] === placed.x)).toBe(false);

    const withPhoto = renderPaper({ image, ...placed, opacity: 0.35 });
    expect(withPhoto.at(-1)?.calls.some((call) => call.op === 'drawImage' && call.args[1] === placed.x)).toBe(true);
  });

  it('paints at the placement and leaves the canvas opaque afterwards', () => {
    const recording = createRecordingCanvas(100, 75);
    const ctx = recording.canvas.getContext('2d');
    if (!ctx) throw new Error('no context');
    paintTracePhoto(ctx, recording.canvas, { x: 40, y: 50, width: 80, height: 60 }, 0.35, 2);
    const draw = recording.calls.find((call) => call.op === 'drawImage');
    expect(draw?.args.slice(1, 5)).toEqual([40, 50, 80, 60]);
    expect(ctx.globalAlpha).toBe(1);
  });
});

function renderPaper(underlay?: ExportUnderlay): RecordingCanvas[] {
  const made: RecordingCanvas[] = [];
  renderArtworkToCanvas({
    space: TRACE_LESSON.coordinateSpace,
    strokes: [],
    clipPaths: {},
    pixelWidth: 100,
    ...(underlay ? { underlay } : {}),
    createCanvas: (width, height) => {
      const recording = createRecordingCanvas(width, height);
      made.push(recording);
      return recording.canvas;
    },
  });
  return made;
}
