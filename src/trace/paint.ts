/**
 * Draws the tracing photo in lesson coordinates.
 * The same call paints the paper while drawing and, when asked, the saved PNG.
 */

import type { TracePlacement } from './placement';

export function paintTracePhoto(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  placement: TracePlacement,
  opacity: number,
  scale: number,
): void {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = Math.min(1, Math.max(0, opacity));
  ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  ctx.restore();
  ctx.globalAlpha = 1;
}
