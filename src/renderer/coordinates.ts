/**
 * Coordinate-space to device mapping.
 *
 * All geometry is authored and stored in a fixed coordinate space (PRD section
 * 12). Resize, rotation and a different pixel ratio only change the viewport
 * here, never the stored points, which is what keeps guides and strokes aligned
 * across orientation changes (AT-06).
 */

import type { Point, RenderSpace, Viewport } from './types';

/**
 * Backing stores are capped at 2x. A 3x tablet would otherwise allocate 2.25x
 * the pixels for no visible gain on line art, and PRD section 13 targets
 * 60 fps on the pilot devices over maximum sharpness.
 */
export const MAX_DEVICE_PIXEL_RATIO = 2;

/**
 * Largest viewport of `space`'s aspect ratio that fits the available CSS box.
 * The canvas element is then sized to exactly that, so the drawing transform is
 * a uniform scale with no letterbox offset to carry around.
 */
export function fitViewport(
  space: RenderSpace,
  availableCssWidth: number,
  availableCssHeight: number,
  devicePixelRatio = 1,
): Viewport {
  const dpr = clampDpr(devicePixelRatio);
  const safeWidth = Math.max(1, availableCssWidth);
  const safeHeight = Math.max(1, availableCssHeight);
  const cssScale = Math.min(safeWidth / space.width, safeHeight / space.height);

  const cssWidth = space.width * cssScale;
  const cssHeight = space.height * cssScale;

  return { cssWidth, cssHeight, dpr, scale: cssScale * dpr };
}

export function clampDpr(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(devicePixelRatio, MAX_DEVICE_PIXEL_RATIO);
}

/** Backing-store size in device pixels for a viewport. */
export function backingSize(viewport: Viewport): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(viewport.cssWidth * viewport.dpr)),
    height: Math.max(1, Math.round(viewport.cssHeight * viewport.dpr)),
  };
}

/**
 * Maps a pointer position relative to the canvas's CSS box into coordinate
 * space. `rect` comes from `getBoundingClientRect()`, so CSS transforms and
 * scroll position are already accounted for.
 */
export function clientToSpace(
  space: RenderSpace,
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): Point {
  const width = rect.width || 1;
  const height = rect.height || 1;
  return {
    x: ((clientX - rect.left) / width) * space.width,
    y: ((clientY - rect.top) / height) * space.height,
  };
}

/** Clamps a point into the drawable area so a stroke cannot wander off-canvas. */
export function clampToSpace(space: RenderSpace, point: Point): Point {
  return {
    x: Math.min(Math.max(point.x, 0), space.width),
    y: Math.min(Math.max(point.y, 0), space.height),
  };
}
