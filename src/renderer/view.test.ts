import { describe, expect, it } from 'vitest';
import { clientToSpace, fitViewport } from './coordinates';
import { DEFAULT_EXPORT_WIDTH_PX } from './export';
import {
  FIT_VIEW,
  MAX_ZOOM,
  clampView,
  frameVisualRect,
  pinchView,
  placementClearingLeft,
  placementForBottom,
  placementForTop,
  stagePointToSpace,
  viewTransformCss,
} from './view';

const space = { width: 1000, height: 750 };

describe('canvas view mapping', () => {
  const stage = { width: 1024, height: 768 };
  const fitted = fitViewport(space, stage.width, stage.height);

  it('maps the paper back onto the lesson at any zoom and pan', () => {
    const views = [
      FIT_VIEW,
      { zoom: 2, panX: 40, panY: -25 },
      { zoom: 3.5, panX: -80, panY: 10 },
    ];
    for (const view of views) {
      const rect = frameVisualRect(stage.width, stage.height, fitted.cssWidth, fitted.cssHeight, view);
      const origin = stagePointToSpace(space, stage.width, stage.height, fitted.cssWidth, fitted.cssHeight, view, rect.left, rect.top);
      const far = stagePointToSpace(
        space,
        stage.width,
        stage.height,
        fitted.cssWidth,
        fitted.cssHeight,
        view,
        rect.left + rect.width,
        rect.top + rect.height,
      );
      expect(origin.x).toBeCloseTo(0, 5);
      expect(origin.y).toBeCloseTo(0, 5);
      expect(far.x).toBeCloseTo(space.width, 5);
      expect(far.y).toBeCloseTo(space.height, 5);
      // The same rectangle is what getBoundingClientRect reports for the
      // transformed frame, so the pointer path and this function agree.
      expect(clientToSpace(space, rect, rect.left + rect.width / 2, rect.top + rect.height / 2)).toEqual(
        stagePointToSpace(
          space,
          stage.width,
          stage.height,
          fitted.cssWidth,
          fitted.cssHeight,
          view,
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        ),
      );
    }
  });

  it('zooms about the fingers and follows them when they slide', () => {
    const startMidX = 400;
    const startMidY = 300;
    const before = stagePointToSpace(
      space,
      stage.width,
      stage.height,
      fitted.cssWidth,
      fitted.cssHeight,
      FIT_VIEW,
      startMidX,
      startMidY,
    );
    const next = pinchView({
      stageWidth: stage.width,
      stageHeight: stage.height,
      fittedWidth: fitted.cssWidth,
      fittedHeight: fitted.cssHeight,
      startView: FIT_VIEW,
      startMidX,
      startMidY,
      startDistance: 200,
      midX: startMidX + 36,
      midY: startMidY - 12,
      distance: 400,
    });
    expect(next.zoom).toBeCloseTo(2, 5);
    const after = stagePointToSpace(
      space,
      stage.width,
      stage.height,
      fitted.cssWidth,
      fitted.cssHeight,
      next,
      startMidX + 36,
      startMidY - 12,
    );
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(viewTransformCss(next)).not.toMatch(/rotate/);
  });

  it('does not let the view change the coordinates export would store', () => {
    // Export renders the lesson space at a fixed width. A zoomed view is not
    // an input to that render, so the same lesson point is the same pixel
    // fraction of the PNG at every zoom.
    const lesson = { x: 250, y: 375 };
    const exportX = (lesson.x / space.width) * DEFAULT_EXPORT_WIDTH_PX;
    const exportY = (lesson.y / space.height) * ((DEFAULT_EXPORT_WIDTH_PX * space.height) / space.width);
    for (const zoom of [1, 2, MAX_ZOOM]) {
      const view = clampView(
        { zoom, panX: 20, panY: -10 },
        stage.width,
        stage.height,
        fitted.cssWidth,
        fitted.cssHeight,
      );
      const rect = frameVisualRect(stage.width, stage.height, fitted.cssWidth, fitted.cssHeight, view);
      const screenX = rect.left + (lesson.x / space.width) * rect.width;
      const screenY = rect.top + (lesson.y / space.height) * rect.height;
      const mapped = stagePointToSpace(
        space,
        stage.width,
        stage.height,
        fitted.cssWidth,
        fitted.cssHeight,
        view,
        screenX,
        screenY,
      );
      expect(mapped.x).toBeCloseTo(lesson.x, 4);
      expect(mapped.y).toBeCloseTo(lesson.y, 4);
      expect((mapped.x / space.width) * DEFAULT_EXPORT_WIDTH_PX).toBeCloseTo(exportX, 4);
      expect((mapped.y / space.height) * ((DEFAULT_EXPORT_WIDTH_PX * space.height) / space.width)).toBeCloseTo(exportY, 4);
    }
  });

  it('clamps zoom and pulls a flung paper back toward the stage', () => {
    expect(clampView({ zoom: 0.2, panX: 80, panY: 80 }, 800, 600, 800, 600)).toEqual(FIT_VIEW);
    const high = clampView({ zoom: 12, panX: 5000, panY: -5000 }, 800, 600, 800, 600);
    expect(high.zoom).toBe(MAX_ZOOM);
    expect(Math.abs(high.panX)).toBeLessThan(5000);
    expect(Math.abs(high.panY)).toBeLessThan(5000);
    expect(clampView({ zoom: Number.NaN, panX: Number.NaN, panY: 0 }, 800, 600, 800, 600)).toEqual(FIT_VIEW);
  });

  it('rests a short sheet on the bottom of the free band', () => {
    const stageHeight = 844;
    const fittedHeight = 250;
    const bottom = 276;
    const placement = placementForBottom(stageHeight, fittedHeight, bottom);
    const rect = frameVisualRect(390, stageHeight, 334, fittedHeight, FIT_VIEW, placement);
    expect(rect.top + rect.height).toBeCloseTo(stageHeight - bottom, 5);
    expect(rect.top).toBeGreaterThan(124);
  });

  it('slides a landscape sheet right of a 200px sample card', () => {
    const placement = placementClearingLeft(1024, 768, 672, 504, 168, 220, 1024 - 80);
    const rect = frameVisualRect(1024, 768, 672, 504, FIT_VIEW, placement);
    expect(rect.left).toBeCloseTo(220, 5);
    expect(rect.top).toBeCloseTo(168, 5);
    expect(rect.left + rect.width).toBeLessThanOrEqual(1024 - 80);
  });

  it('can rest the paper higher on the stage and still map a pinch', () => {
    const phone = { width: 390, height: 844 };
    const phoneFit = fitViewport(space, phone.width, phone.height);
    const placement = placementForTop(phone.height, phoneFit.cssHeight, 68);
    expect(placement.offsetY).toBeLessThan(0);
    const rect = frameVisualRect(phone.width, phone.height, phoneFit.cssWidth, phoneFit.cssHeight, FIT_VIEW, placement);
    expect(rect.top).toBeCloseTo(68, 5);
    const before = stagePointToSpace(
      space,
      phone.width,
      phone.height,
      phoneFit.cssWidth,
      phoneFit.cssHeight,
      FIT_VIEW,
      180,
      200,
      placement,
    );
    const next = pinchView({
      stageWidth: phone.width,
      stageHeight: phone.height,
      fittedWidth: phoneFit.cssWidth,
      fittedHeight: phoneFit.cssHeight,
      startView: FIT_VIEW,
      startMidX: 180,
      startMidY: 200,
      startDistance: 120,
      midX: 200,
      midY: 210,
      distance: 240,
      placement,
    });
    const after = stagePointToSpace(
      space,
      phone.width,
      phone.height,
      phoneFit.cssWidth,
      phoneFit.cssHeight,
      next,
      200,
      210,
      placement,
    );
    expect(after.x).toBeCloseTo(before.x, 4);
    expect(after.y).toBeCloseTo(before.y, 4);
    expect(viewTransformCss(next, placement)).not.toMatch(/rotate/);
  });
});
