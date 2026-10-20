import { describe, expect, it } from 'vitest';
import {
  brushPreviewPx,
  brushWidthRange,
  defaultBrushWidth,
  sliderFollowsStep,
  snapWidth,
} from './brush-size';

describe('brushWidthRange', () => {
  it('keeps the step width and the eraser width on a slider step', () => {
    for (const stepWidth of [5, 6, 8, 18, 48]) {
      const range = brushWidthRange(stepWidth);
      expect(snapWidth(stepWidth, range)).toBe(stepWidth);
      expect(snapWidth(stepWidth * 2, range)).toBe(stepWidth * 2);
      expect(range.min).toBeLessThan(stepWidth);
      expect(range.max).toBeGreaterThan(stepWidth * 2);
    }
  });

  it('treats a non-positive prepared width as a usable range', () => {
    const range = brushWidthRange(0);
    expect(range.max).toBeGreaterThan(range.min);
    expect(range.step).toBeGreaterThan(0);
  });
});

describe('brushPreviewPx', () => {
  it('grows from a thin dot to a thick one without leaving the slider column', () => {
    const range = brushWidthRange(8);
    expect(brushPreviewPx(range.min, range)).toBeLessThan(brushPreviewPx(range.max, range));
    expect(brushPreviewPx(range.max, range)).toBeLessThanOrEqual(22);
    expect(brushPreviewPx(range.min, range)).toBeGreaterThanOrEqual(6);
  });
});

describe('sliderFollowsStep', () => {
  it('clears the override on the prepared width and keeps a deliberate one', () => {
    expect(sliderFollowsStep(8, 'pen', 8)).toBe(true);
    expect(sliderFollowsStep(8, 'pen', 12)).toBe(false);
    expect(defaultBrushWidth(8, 'eraser')).toBe(16);
    expect(sliderFollowsStep(8, 'eraser', 16)).toBe(true);
    expect(sliderFollowsStep(8, 'eraser', 8)).toBe(false);
  });
});
