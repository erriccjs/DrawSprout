/**
 * The vertical brush slider, expressed in lesson-coordinate widths.
 *
 * The step still prepares a width (FR-03). The slider is a continuous range
 * around that width. Landing back on the prepared width clears the override
 * so the next step can bring its own size.
 */

import type { ToolKind } from '../lesson-engine/types';

/** How far either side of the step's prepared width the slider reaches. */
export const BRUSH_MIN_FACTOR = 0.4;
export const BRUSH_MAX_FACTOR = 2.5;

export interface BrushWidthRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export function roundWidth(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A range whose step divides both the prepared width and the eraser's doubled
 * width, so the thumb can sit on the preset without the browser snapping it.
 */
export function brushWidthRange(stepWidth: number): BrushWidthRange {
  const safe = stepWidth > 0 ? stepWidth : 1;
  return {
    min: roundWidth(safe * BRUSH_MIN_FACTOR),
    max: roundWidth(safe * BRUSH_MAX_FACTOR),
    step: roundWidth(safe * 0.05),
  };
}

/** Width the slider shows when the child has not overridden this step. */
export function defaultBrushWidth(stepWidth: number, tool: ToolKind): number {
  return tool === 'eraser' ? roundWidth(stepWidth * 2) : stepWidth;
}

export function snapWidth(value: number, range: BrushWidthRange): number {
  const clamped = Math.min(range.max, Math.max(range.min, value));
  const steps = Math.round((clamped - range.min) / range.step);
  return roundWidth(range.min + steps * range.step);
}

/** True when the thumb is on the step's own width, so the override should clear. */
export function sliderFollowsStep(stepWidth: number, tool: ToolKind, value: number): boolean {
  return snapWidth(value, brushWidthRange(stepWidth)) === snapWidth(defaultBrushWidth(stepWidth, tool), brushWidthRange(stepWidth));
}
