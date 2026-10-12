/**
 * PNG export (FR-06, FR-14, AT-01).
 *
 * The claim under test is "the export contains the child's artwork and nothing
 * else". Two things establish it:
 *
 *  - structurally, `ExportOptions` has no field a guide path could arrive in,
 *    so the lesson's guide geometry is not reachable from this code path;
 *  - behaviourally, the recording canvas shows exactly the stroke geometry and
 *    no dashed geometry at all.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CAT_LESSON } from '../lesson-data/cat-lesson';
import {
  constructedPathData,
  createRecordingCanvas,
  pathPoints,
  resetConstructedPathData,
  type RecordingCanvas,
} from '../test/fake-canvas';
import { clipPathsFromLesson } from '../ui/render-adapter';
import { artworkFileName, exportArtworkPng, renderArtworkToCanvas } from './export';
import type { CanvasFactory, RenderStroke } from './types';

const space = CAT_LESSON.coordinateSpace;
const clipPaths = clipPathsFromLesson(CAT_LESSON);

const inkStroke: RenderStroke = {
  points: [
    { x: 100, y: 100 },
    { x: 200, y: 150 },
    { x: 300, y: 120 },
  ],
  color: '#3a3a3a',
  width: 8,
  layer: 'ink',
  erase: false,
  clipPathIds: [],
};

function recordingFactory() {
  const recordings: RecordingCanvas[] = [];
  const factory: CanvasFactory = (widthPx, heightPx) => {
    const recording = createRecordingCanvas(widthPx, heightPx);
    recordings.push(recording);
    return recording.canvas;
  };
  const allCalls = () => recordings.flatMap((recording) => recording.calls);
  return { factory, recordings, allCalls };
}

beforeEach(() => {
  resetConstructedPathData();
});

describe('exported artwork', () => {
  it('draws the child strokes and nothing else', () => {
    const { factory, allCalls } = recordingFactory();
    renderArtworkToCanvas({
      space,
      strokes: [inkStroke],
      clipPaths,
      pixelWidth: 1000,
      createCanvas: factory,
    });

    const calls = allCalls();
    // One `stroke()` for the one stroke in the session.
    expect(calls.filter((call) => call.op === 'stroke')).toHaveLength(1);

    // The geometry is the stroke's own points (the midpoint smoothing keeps the
    // first and last samples exactly where the child put them).
    const points = pathPoints(calls);
    expect(points[0]).toEqual([100, 100]);
    expect(points.at(-1)).toEqual([300, 120]);
  });

  it('draws nothing when the child has not drawn, even though the lesson has guides', () => {
    const { factory, allCalls } = recordingFactory();
    expect(CAT_LESSON.steps[0]!.guidePaths.length).toBeGreaterThan(0);

    renderArtworkToCanvas({
      space,
      strokes: [],
      clipPaths,
      pixelWidth: 1000,
      createCanvas: factory,
    });

    const calls = allCalls();
    expect(calls.filter((call) => ['stroke', 'fill'].includes(call.op))).toEqual([]);
    // Only the paper background was filled.
    expect(calls.filter((call) => call.op === 'fillRect')).toHaveLength(1);
  });

  it('keeps the paper behind the artwork instead of over or under nothing', () => {
    // `compositeTo` clears its target, so the background has to go on after the
    // artwork, in `destination-over`. Getting this backwards silently produces
    // a fully transparent PNG.
    const { factory, recordings } = recordingFactory();
    renderArtworkToCanvas({
      space,
      strokes: [inkStroke],
      clipPaths,
      pixelWidth: 1000,
      createCanvas: factory,
    });

    const output = recordings.at(-1)!.calls;
    const clearedAt = output.findIndex((call) => call.op === 'clearRect');
    const paperAt = output.findIndex((call) => call.op === 'fillRect');
    const compositeAt = output.findIndex((call) => call.op === 'drawImage');

    expect(clearedAt).toBeGreaterThanOrEqual(0);
    expect(compositeAt).toBeGreaterThan(clearedAt);
    expect(paperAt).toBeGreaterThan(compositeAt);

    // ...and the paper is filled in `destination-over`, so it slides underneath
    // the artwork rather than painting over it.
    const modeWhenFilling = output
      .slice(0, paperAt)
      .filter((call) => call.op === 'set:globalCompositeOperation')
      .at(-1);
    expect(modeWhenFilling?.args[0]).toBe('destination-over');

    // The mode is put back, so the context is not left in a surprising state.
    expect(output.at(-1)?.args[0]).toBe('source-over');
  });

  it('never dashes anything, which is the only way a guide is drawn', () => {
    const { factory, allCalls } = recordingFactory();
    renderArtworkToCanvas({
      space,
      strokes: [inkStroke],
      clipPaths,
      pixelWidth: 1000,
      createCanvas: factory,
    });

    const dashCalls = allCalls().filter((call) => call.op === 'setLineDash');
    expect(dashCalls.length).toBeGreaterThan(0);
    for (const call of dashCalls) expect(call.args[0]).toEqual([]);
  });

  it('never hands a guide path to the renderer, only colour-region clips', () => {
    const { factory } = recordingFactory();
    const colorStroke: RenderStroke = {
      ...inkStroke,
      layer: 'color',
      color: '#e8a33d',
      width: 48,
      clipPathIds: ['fur-head', 'fur-body'],
    };

    renderArtworkToCanvas({
      space,
      strokes: [colorStroke],
      clipPaths,
      pixelWidth: 1000,
      createCanvas: factory,
    });

    const guideData = new Set(
      CAT_LESSON.steps.flatMap((step) => step.guidePaths.map((path) => path.d)),
    );
    const regionData = new Set(CAT_LESSON.colorRegions.map((region) => region.d));

    expect(constructedPathData.length).toBeGreaterThan(0);
    for (const d of constructedPathData) {
      expect(regionData.has(d)).toBe(true);
      expect(guideData.has(d)).toBe(false);
    }
  });

  it('composites colour under ink so the outline stays visible', () => {
    const { factory, recordings } = recordingFactory();
    renderArtworkToCanvas({
      space,
      strokes: [inkStroke],
      clipPaths,
      pixelWidth: 1000,
      createCanvas: factory,
    });

    // The factory is called for the colour layer, the ink layer, then the
    // output canvas.
    const [colorLayer, inkLayer, output] = recordings;
    const composited = output!.calls
      .filter((call) => call.op === 'drawImage')
      .map((call) => call.args[0]);

    expect(composited).toEqual([colorLayer!.canvas, inkLayer!.canvas]);
  });

  it('scales to the requested pixel width while keeping the aspect ratio', () => {
    const canvas = renderArtworkToCanvas({
      space,
      strokes: [inkStroke],
      clipPaths,
      pixelWidth: 1500,
    });
    expect(canvas.width).toBe(1500);
    expect(canvas.height).toBe(Math.round((1500 * space.height) / space.width));
  });

  it('produces PNG bytes', async () => {
    const blob = await exportArtworkPng({ space, strokes: [inkStroke], clipPaths, pixelWidth: 400 });
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('artwork file name', () => {
  it('slugs the lesson title and stamps the time', () => {
    expect(artworkFileName('Kucing Duduk', new Date(2026, 9, 12, 14, 5))).toBe(
      'kucing-duduk-202610121405.png',
    );
  });

  it('falls back to a generic name when the title has no usable characters', () => {
    expect(artworkFileName('🎨', new Date(2026, 0, 1, 0, 0))).toBe('gambar-202601010000.png');
  });
});
