/**
 * Paints one moment of a living picture.
 *
 * The canvas receives the child's strokes only. Guide paths are not a
 * parameter, so the animation cannot fall back to the reference art.
 */

import type { CoordinateSpace } from '../lesson-data/schema';
import type { ExportUnderlay } from '../renderer/export';
import { strokeWholePath } from '../renderer/strokes';
import { paintTracePhoto } from '../trace/paint';
import type { AliveDraw, AliveFrame, AliveStroke } from './presets';
import { frameAt } from './presets';
import type { Transform2D } from './motion';

/** Wide enough to look smooth, small enough for a cheap Android GPU. */
export const ALIVE_WIDTH_PX = 800;

export function paintAlive(
  canvas: HTMLCanvasElement,
  lessonId: string,
  space: CoordinateSpace,
  strokes: readonly AliveStroke[],
  t: number,
  clipPaths: Record<string, string> = {},
  underlay?: ExportUnderlay,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const frame = frameAt(lessonId, space, strokes, t);
  const scale = canvas.width / Math.max(1, space.width);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (underlay) paintTracePhoto(ctx, underlay.image, underlay, underlay.opacity, scale);

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  applyTransform(ctx, frame.whole);
  for (const draw of paintOrder(frame)) {
    if (!draw.visible) continue;
    ctx.save();
    applyTransform(ctx, draw.transform);
    ctx.globalAlpha = draw.stroke.erase ? 1 : draw.transform.alpha;
    paintStroke(ctx, draw.stroke, clipPaths);
    ctx.restore();
  }
  paintDots(ctx, frame);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function paintOrder(frame: AliveFrame): readonly AliveDraw[] {
  if (frame.mode === 'redraw') return frame.draws;
  return [
    ...frame.draws.filter((draw) => draw.stroke.layer === 'color'),
    ...frame.draws.filter((draw) => draw.stroke.layer === 'ink'),
  ];
}

function paintDots(ctx: CanvasRenderingContext2D, frame: AliveFrame): void {
  for (const puff of frame.puffs) {
    ctx.save();
    ctx.globalAlpha = puff.alpha;
    ctx.fillStyle = puff.color;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const sparkle of frame.sparkles) {
    ctx.save();
    ctx.globalAlpha = sparkle.alpha;
    ctx.fillStyle = sparkle.color;
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function applyTransform(ctx: CanvasRenderingContext2D, transform: Transform2D): void {
  ctx.translate(transform.pivotX + transform.translateX, transform.pivotY + transform.translateY);
  ctx.rotate(transform.rotation);
  ctx.scale(transform.scaleX, transform.scaleY);
  ctx.translate(-transform.pivotX, -transform.pivotY);
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: AliveStroke, clipPaths: Record<string, string>): void {
  const clips = stroke.clipRegionIds.flatMap((id) => {
    const path = clipPaths[id];
    return path ? [path] : [];
  });
  ctx.save();
  const clip = clipPath(clips);
  if (clip) ctx.clip(clip);
  ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  strokeWholePath(ctx, stroke.points);
  ctx.restore();
}

function clipPath(paths: readonly string[]): Path2D | null {
  const first = paths[0];
  if (!first) return null;
  if (paths.length === 1 || typeof Path2D.prototype.addPath !== 'function') return new Path2D(first);
  const combined = new Path2D();
  for (const path of paths) combined.addPath(new Path2D(path));
  return combined;
}
