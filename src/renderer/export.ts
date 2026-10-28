/**
 * PNG export.
 *
 * The signature is the guarantee: this module accepts strokes and clip paths
 * and nothing else. There is no parameter through which a guide path, a hint or
 * the target illustration could reach the exported image, which is what FR-06,
 * FR-14 and AT-01 require. The guide overlay is an SVG element layered over the
 * canvas, so it is not part of any canvas this code can read either.
 */

import { paintTracePhoto } from '../trace/paint';
import { ArtworkSurface } from './artwork-surface';
import type { CanvasFactory, RenderSpace, RenderStroke, Viewport } from './types';

/** Paper colour behind the artwork; `null` exports a transparent PNG. */
const DEFAULT_BACKGROUND = '#ffffff';

/** Wide enough to print or share without being wasteful on a tablet. */
export const DEFAULT_EXPORT_WIDTH_PX = 2000;

export interface ExportUnderlay {
  readonly image: CanvasImageSource;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

export interface ExportOptions {
  readonly space: RenderSpace;
  readonly strokes: readonly RenderStroke[];
  readonly clipPaths: Record<string, string>;
  readonly pixelWidth?: number;
  readonly background?: string | null;
  readonly createCanvas?: CanvasFactory;
  /** A tracing photo drawn under the strokes. Omitted means the lines only. */
  readonly underlay?: ExportUnderlay;
}

const defaultCanvasFactory: CanvasFactory = (widthPx, heightPx) => {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  return canvas;
};

/** Renders the artwork to a detached canvas at export resolution. */
export function renderArtworkToCanvas(options: ExportOptions): HTMLCanvasElement {
  const {
    space,
    strokes,
    clipPaths,
    pixelWidth = DEFAULT_EXPORT_WIDTH_PX,
    background = DEFAULT_BACKGROUND,
    createCanvas = defaultCanvasFactory,
    underlay,
  } = options;

  const scale = pixelWidth / space.width;
  const viewport: Viewport = {
    cssWidth: space.width * scale,
    cssHeight: space.height * scale,
    dpr: 1,
    scale,
  };

  const surface = new ArtworkSurface(space, viewport, createCanvas);
  surface.setClipPaths(clipPaths);
  surface.replay(strokes);

  const widthPx = Math.round(viewport.cssWidth);
  const heightPx = Math.round(viewport.cssHeight);
  const output = createCanvas(widthPx, heightPx);
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  // The artwork goes down first. `compositeTo` clears its target, so painting
  // the paper beforehand would wipe it; `destination-over` slides the
  // background underneath what is already there instead.
  surface.compositeTo(ctx);
  if (underlay) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    paintTracePhoto(ctx, underlay.image, underlay, underlay.opacity, scale);
    ctx.restore();
  }
  if (background !== null) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.globalCompositeOperation = 'source-over';
  }
  return output;
}

/**
 * Produces the PNG bytes.
 *
 * Rejects rather than resolving with an empty blob, so the caller can tell the
 * child that saving failed instead of handing them a broken file.
 */
export async function exportArtworkPng(options: ExportOptions): Promise<Blob> {
  const canvas = renderArtworkToCanvas(options);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Browser did not produce a PNG from the artwork canvas'));
    }, 'image/png');
  });
}

/**
 * Filename that tells a parent what the file is without leaking any content.
 * `title` is just a string to slug; the renderer does not know it came from a
 * lesson.
 */
export function artworkFileName(title: string, at: Date = new Date()): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'gambar';
  const stamp = [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, '0'),
    String(at.getDate()).padStart(2, '0'),
    String(at.getHours()).padStart(2, '0'),
    String(at.getMinutes()).padStart(2, '0'),
  ].join('');
  return `${slug}-${stamp}.png`;
}
