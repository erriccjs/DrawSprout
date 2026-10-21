/**
 * A view on top of the fitted lesson canvas.
 *
 * Zoom and pan move the paper on screen. They do not move stored points.
 * Guides live in the same transformed frame as the canvas, so they stay
 * aligned, and export never reads this view: it replays lesson coordinates
 * at a fixed pixel width.
 */

import { clientToSpace } from './coordinates';
import type { Point, RenderSpace } from './types';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface CanvasView {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export const FIT_VIEW: CanvasView = { zoom: 1, panX: 0, panY: 0 };

/**
 * A shift of the fitted frame away from the center of the stage.
 * Zoom and pan stay in `CanvasView`. This offset is layout only: it lets a
 * phone sit the paper under the header without storing a different geometry.
 */
export interface PaperPlacement {
  readonly offsetX: number;
  readonly offsetY: number;
}

export const CENTERED_PLACEMENT: PaperPlacement = { offsetX: 0, offsetY: 0 };

/** Move a centered frame so its top edge lands at `top`, clamped inside the stage. */
export function placementForTop(stageHeight: number, fittedHeight: number, top: number): PaperPlacement {
  if (stageHeight <= 0 || fittedHeight <= 0) return CENTERED_PLACEMENT;
  const centeredTop = (stageHeight - fittedHeight) / 2;
  const desired = clamp(finite(top, centeredTop), 0, Math.max(0, stageHeight - fittedHeight));
  return { offsetX: 0, offsetY: desired - centeredTop };
}

/** Rest the sheet on the bottom of the free band, `bottom` px above the stage edge. */
export function placementForBottom(stageHeight: number, fittedHeight: number, bottom: number): PaperPlacement {
  return placementForTop(stageHeight, fittedHeight, stageHeight - bottom - fittedHeight);
}

/**
 * Top-align the sheet, then slide it right until its left edge clears `left`.
 * It stops before `rightLimit` so a dock on the right stays uncovered.
 */
export function placementClearingLeft(
  stageWidth: number,
  stageHeight: number,
  fittedWidth: number,
  fittedHeight: number,
  top: number,
  left: number,
  rightLimit: number,
): PaperPlacement {
  const base = placementForTop(stageHeight, fittedHeight, top);
  const centeredLeft = (stageWidth - fittedWidth) / 2;
  const maxLeft = Math.max(centeredLeft, rightLimit - fittedWidth);
  const nextLeft = Math.min(Math.max(centeredLeft, left), maxLeft);
  return { offsetX: base.offsetX + (nextLeft - centeredLeft), offsetY: base.offsetY };
}

export interface FrameRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** CSS transform for a frame whose layout box is the fitted paper, origin at its center. */
export function viewTransformCss(view: CanvasView, placement: PaperPlacement = CENTERED_PLACEMENT): string {
  return `translate(${view.panX + placement.offsetX}px, ${view.panY + placement.offsetY}px) scale(${view.zoom})`;
}

/**
 * Where the fitted paper lands in the stage after `viewTransformCss`.
 * No rotation: the box stays axis-aligned, which is what keeps a pinch from
 * twisting the lesson.
 */
export function frameVisualRect(
  stageWidth: number,
  stageHeight: number,
  fittedWidth: number,
  fittedHeight: number,
  view: CanvasView,
  placement: PaperPlacement = CENTERED_PLACEMENT,
): FrameRect {
  const width = fittedWidth * view.zoom;
  const height = fittedHeight * view.zoom;
  return {
    left: stageWidth / 2 + view.panX + placement.offsetX - width / 2,
    top: stageHeight / 2 + view.panY + placement.offsetY - height / 2,
    width,
    height,
  };
}

/** Screen point (stage origin) to lesson coordinates at the current view. */
export function stagePointToSpace(
  space: RenderSpace,
  stageWidth: number,
  stageHeight: number,
  fittedWidth: number,
  fittedHeight: number,
  view: CanvasView,
  stageX: number,
  stageY: number,
  placement: PaperPlacement = CENTERED_PLACEMENT,
): Point {
  return clientToSpace(
    space,
    frameVisualRect(stageWidth, stageHeight, fittedWidth, fittedHeight, view, placement),
    stageX,
    stageY,
  );
}

export function sameView(a: CanvasView, b: CanvasView): boolean {
  return a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY;
}

/**
 * Keeps at least a sliver of the paper on the stage, and returns to a centered
 * fit at zoom 1 so "sesuai layar" is a single state.
 */
export function clampView(
  view: CanvasView,
  stageWidth: number,
  stageHeight: number,
  fittedWidth: number,
  fittedHeight: number,
): CanvasView {
  const zoom = clamp(finite(view.zoom, 1), MIN_ZOOM, MAX_ZOOM);
  if (zoom === MIN_ZOOM) return FIT_VIEW;
  return {
    zoom,
    panX: clampPan(view.panX, stageWidth, fittedWidth, zoom),
    panY: clampPan(view.panY, stageHeight, fittedHeight, zoom),
  };
}

export interface PinchInput {
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly fittedWidth: number;
  readonly fittedHeight: number;
  readonly startView: CanvasView;
  readonly startMidX: number;
  readonly startMidY: number;
  readonly startDistance: number;
  readonly midX: number;
  readonly midY: number;
  readonly distance: number;
  readonly placement?: PaperPlacement;
}

/**
 * Zoom about the point that was under the fingers when the pinch began, then
 * follow the fingers as they slide. The ratio is against the gesture's own
 * start, so successive moves do not compound.
 */
export function pinchView(input: PinchInput): CanvasView {
  if (input.startDistance < 1 || input.distance < 1 || input.fittedWidth <= 0 || input.fittedHeight <= 0) {
    return input.startView;
  }
  const zoom = input.startView.zoom * (input.distance / input.startDistance);
  const placement = input.placement ?? CENTERED_PLACEMENT;
  const startVisualWidth = input.fittedWidth * input.startView.zoom;
  const startVisualHeight = input.fittedHeight * input.startView.zoom;
  const centerX = input.stageWidth / 2 + input.startView.panX + placement.offsetX;
  const centerY = input.stageHeight / 2 + input.startView.panY + placement.offsetY;
  const across = startVisualWidth === 0 ? 0 : (input.startMidX - centerX) / startVisualWidth;
  const down = startVisualHeight === 0 ? 0 : (input.startMidY - centerY) / startVisualHeight;
  return clampView(
    {
      zoom,
      panX: input.midX - input.stageWidth / 2 - placement.offsetX - across * input.fittedWidth * zoom,
      panY: input.midY - input.stageHeight / 2 - placement.offsetY - down * input.fittedHeight * zoom,
    },
    input.stageWidth,
    input.stageHeight,
    input.fittedWidth,
    input.fittedHeight,
  );
}

function clampPan(pan: number, stage: number, fitted: number, zoom: number): number {
  const overflow = Math.max(0, (fitted * zoom - stage) / 2);
  const limit = overflow + Math.min(48, Math.max(stage, 0) * 0.08);
  return clamp(finite(pan, 0), -limit, limit);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
