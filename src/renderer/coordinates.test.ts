/**
 * Coordinate mapping (AT-06).
 *
 * Geometry is stored in lesson coordinates, so resizing the window, rotating
 * the tablet or moving to a different pixel ratio must not move a point.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_DEVICE_PIXEL_RATIO,
  backingSize,
  clampDpr,
  clampToSpace,
  clientToSpace,
  fitViewport,
} from './coordinates';

const space = { width: 1000, height: 750 };

describe('fitViewport', () => {
  it('keeps the aspect ratio when the box is wider than the drawing', () => {
    const viewport = fitViewport(space, 1600, 750);
    expect(viewport.cssWidth).toBe(1000);
    expect(viewport.cssHeight).toBe(750);
  });

  it('keeps the aspect ratio when the box is taller than the drawing', () => {
    const viewport = fitViewport(space, 500, 1000);
    expect(viewport.cssWidth).toBe(500);
    expect(viewport.cssHeight).toBe(375);
  });

  it('scales a phone-sized stage uniformly onto the same 1000×750 space (AT-06)', () => {
    const phonePortrait = fitViewport(space, 344, 280);
    const phoneLandscape = fitViewport(space, 347, 300);
    const tablet = fitViewport(space, 668, 563);

    for (const viewport of [phonePortrait, phoneLandscape, tablet]) {
      expect(viewport.cssWidth / viewport.cssHeight).toBeCloseTo(space.width / space.height, 5);
      const point = clientToSpace(
        space,
        { left: 12, top: 40, width: viewport.cssWidth, height: viewport.cssHeight },
        12 + viewport.cssWidth * 0.25,
        40 + viewport.cssHeight * 0.5,
      );
      expect(point.x).toBeCloseTo(250, 5);
      expect(point.y).toBeCloseTo(375, 5);
    }
  });

  it('caps the backing store at the documented pixel ratio', () => {
    const viewport = fitViewport(space, 1000, 750, 3);
    expect(viewport.dpr).toBe(MAX_DEVICE_PIXEL_RATIO);
    expect(backingSize(viewport)).toEqual({ width: 2000, height: 1500 });
  });

  it('survives a zero-sized container during layout', () => {
    const viewport = fitViewport(space, 0, 0, 2);
    expect(viewport.cssWidth).toBeGreaterThan(0);
    expect(backingSize(viewport).width).toBeGreaterThanOrEqual(1);
  });

  it('treats a nonsensical pixel ratio as 1', () => {
    expect(clampDpr(Number.NaN)).toBe(1);
    expect(clampDpr(0)).toBe(1);
    expect(clampDpr(-2)).toBe(1);
  });
});

describe('clientToSpace', () => {
  it('maps the same physical touch to the same lesson point at any size (AT-06)', () => {
    // The same relative position on a landscape canvas and on the same canvas
    // after a rotation to a smaller portrait box.
    const landscape = { left: 40, top: 20, width: 1000, height: 750 };
    const portrait = { left: 0, top: 120, width: 600, height: 450 };

    const fromLandscape = clientToSpace(space, landscape, 40 + 250, 20 + 375);
    const fromPortrait = clientToSpace(space, portrait, 0 + 150, 120 + 225);

    expect(fromLandscape).toEqual({ x: 250, y: 375 });
    expect(fromPortrait).toEqual({ x: 250, y: 375 });
  });

  it('does not divide by zero while the canvas is still being laid out', () => {
    const point = clientToSpace(space, { left: 0, top: 0, width: 0, height: 0 }, 10, 10);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});

describe('clampToSpace', () => {
  it('holds a stroke inside the drawable area', () => {
    expect(clampToSpace(space, { x: -50, y: 900 })).toEqual({ x: 0, y: 750 });
    expect(clampToSpace(space, { x: 400, y: 400 })).toEqual({ x: 400, y: 400 });
  });
});
