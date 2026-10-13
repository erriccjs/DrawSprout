/**
 * Stroke drawing primitives.
 *
 * Drawing goes straight through `CanvasRenderingContext2D` calls rather than
 * building a `Path2D`, because the pointer loop draws one new segment per move
 * and because that keeps the draw calls observable in tests.
 */

import type { Point, RenderStroke } from './types';

/** Shape of the paint, independent of which points it is applied to. */
export function applyStrokeStyle(
  ctx: CanvasRenderingContext2D,
  stroke: Pick<RenderStroke, 'color' | 'width' | 'erase'>,
): void {
  ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Guides are the only dashed geometry in the app; make sure a previous dashed
  // draw on a shared context can never leak into a child's stroke.
  ctx.setLineDash([]);
}

/**
 * Draws a whole stroke. Light smoothing: the path runs through the midpoints
 * between samples with each sample as the quadratic control point, which takes
 * the corners off raw pointer noise without moving the line away from where the
 * child drew (PRD section 11, "stroke smoothing ringan").
 */
export function strokeWholePath(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  const first = points[0];
  if (!first) return;

  if (points.length === 1) {
    drawDot(ctx, first, ctx.lineWidth / 2);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const next = points[i + 1]!;
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = points[points.length - 1]!;
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

/**
 * Draws only the newest segment of a growing stroke, so a pointermove costs the
 * same whether the stroke is 5 or 500 points long.
 *
 * Round caps on opaque paint make overlapping segments indistinguishable from a
 * single continuous path.
 */
export function strokeSegment(ctx: CanvasRenderingContext2D, from: Point, to: Point): void {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

export function drawDot(ctx: CanvasRenderingContext2D, at: Point, radius: number): void {
  ctx.beginPath();
  ctx.arc(at.x, at.y, Math.max(radius, 0.01), 0, Math.PI * 2);
  ctx.fill();
}
