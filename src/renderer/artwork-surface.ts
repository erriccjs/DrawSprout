/**
 * The child's artwork, held as two offscreen layers and composited onto a
 * visible canvas.
 *
 * Two properties drive the design:
 *
 * 1. A pointermove must not cost a React render or a full repaint, so a growing
 *    stroke is baked into its layer one segment at a time and the visible
 *    canvas is refreshed with two `drawImage` calls (PRD section 11).
 * 2. Guides never live here. This class only ever receives strokes, which is
 *    why a PNG produced from it cannot contain the guide overlay or the target
 *    illustration (FR-06, FR-14, AT-01).
 */

import { applyStrokeStyle, drawDot, strokeSegment, strokeWholePath } from './strokes';
import { backingSize } from './coordinates';
import type {
  CanvasFactory,
  LiveStrokeSpec,
  Point,
  RenderLayer,
  RenderSpace,
  RenderStroke,
  Viewport,
} from './types';

interface Layer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
}

const defaultCanvasFactory: CanvasFactory = (widthPx, heightPx) => {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  return canvas;
};

export class ArtworkSurface {
  readonly space: RenderSpace;

  private readonly createCanvas: CanvasFactory;
  private readonly layers: Record<RenderLayer, Layer>;
  private readonly clipPathCache = new Map<string, Path2D>();

  private clipPathData: Record<string, string> = {};
  private viewport: Viewport;
  private committed: readonly RenderStroke[] = [];

  private live: { spec: LiveStrokeSpec; points: Point[] } | null = null;

  constructor(space: RenderSpace, viewport: Viewport, createCanvas: CanvasFactory = defaultCanvasFactory) {
    this.space = space;
    this.viewport = viewport;
    this.createCanvas = createCanvas;
    const { width, height } = backingSize(viewport);
    this.layers = {
      color: this.makeLayer(width, height),
      ink: this.makeLayer(width, height),
    };
  }

  /**
   * Registers the clip geometry available to strokes, as id to SVG path data.
   * Ids are opaque here: the renderer has no idea they describe cat fur.
   */
  setClipPaths(paths: Record<string, string>): void {
    this.clipPathData = paths;
    this.clipPathCache.clear();
  }

  /** Resizes the layers and redraws the committed strokes at the new scale. */
  resize(viewport: Viewport): void {
    const next = backingSize(viewport);
    const current = backingSize(this.viewport);
    if (next.width === current.width && next.height === current.height) {
      this.viewport = viewport;
      return;
    }
    this.viewport = viewport;
    for (const layer of Object.values(this.layers)) {
      layer.canvas.width = next.width;
      layer.canvas.height = next.height;
    }
    // Geometry is stored in coordinate space, so a resize is a pure replay —
    // nothing about the artwork itself changes (AT-06).
    this.replay(this.committed);
  }

  /**
   * Clears both layers and redraws every stroke in order.
   *
   * A stroke the child is still drawing survives: it is redrawn from its
   * samples after the committed ones and stays live, so a replay provoked
   * mid-stroke by a resize or a reflow neither loses its ink nor leaves the
   * rest of the stroke with nothing to extend.
   */
  replay(strokes: readonly RenderStroke[]): void {
    this.committed = strokes;
    for (const layer of Object.values(this.layers)) {
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.globalCompositeOperation = 'source-over';
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    }
    for (const stroke of strokes) {
      this.paint(stroke, (target) => {
        strokeWholePath(target, stroke.points);
      });
    }
    const live = this.live;
    if (!live) return;
    this.paint(live.spec, (target) => {
      strokeWholePath(target, live.points);
    });
  }

  beginStroke(spec: LiveStrokeSpec, at: Point): void {
    this.live = { spec, points: [at] };
    this.paint(spec, (target) => {
      // A tap is a legitimate dot, so the stroke is visible from the first
      // sample rather than only once the pointer moves.
      drawDot(target, at, spec.width / 2);
    });
  }

  /** Appends a sample and paints only the new segment. */
  extendStroke(to: Point): void {
    const live = this.live;
    if (!live) return;
    const from = live.points[live.points.length - 1]!;
    live.points.push(to);
    this.paint(live.spec, (target) => {
      strokeSegment(target, from, to);
    });
  }

  /** Paints on the stroke's layer, or on both layers when `eraseAll` is set. */
  private paint(spec: LiveStrokeSpec, draw: (ctx: CanvasRenderingContext2D) => void): void {
    const layers: RenderLayer[] = spec.eraseAll ? ['color', 'ink'] : [spec.layer];
    for (const layer of layers) {
      const { ctx } = this.layers[layer];
      this.prepare(ctx, spec);
      this.withClip(ctx, spec.clipPathIds, draw);
    }
  }

  /**
   * Finishes the live stroke and returns its samples so the caller can commit
   * them to the session. The pixels are already on the layer, so a cancelled
   * pointer keeps the ink it produced instead of vanishing — what AT-17 forbids
   * is the *next* stroke joining up with it, and that cannot happen because the
   * live stroke is cleared here either way.
   */
  endStroke(): readonly Point[] | null {
    const live = this.live;
    this.live = null;
    if (!live) return null;
    return live.points;
  }

  hasLiveStroke(): boolean {
    return this.live !== null;
  }

  /** Paints colour then ink onto the visible canvas. */
  compositeTo(ctx: CanvasRenderingContext2D): void {
    const { width, height } = backingSize(this.viewport);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(this.layers.color.canvas, 0, 0, width, height);
    ctx.drawImage(this.layers.ink.canvas, 0, 0, width, height);
  }

  layerCanvas(layer: RenderLayer): HTMLCanvasElement {
    return this.layers[layer].canvas;
  }

  private makeLayer(widthPx: number, heightPx: number): Layer {
    const canvas = this.createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    return { canvas, ctx };
  }

  private prepare(ctx: CanvasRenderingContext2D, stroke: LiveStrokeSpec): void {
    const { scale } = this.viewport;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    applyStrokeStyle(ctx, stroke);
  }

  /**
   * Runs `draw` confined to the union of the given clip paths.
   *
   * Canvas `clip()` intersects, so a union is produced by drawing once per
   * region instead. With opaque paint and round caps a doubly-drawn overlap is
   * pixel-identical to a single pass, which is why the regions in a lesson may
   * overlap freely and their path winding never has to be normalised.
   */
  private withClip(
    ctx: CanvasRenderingContext2D,
    clipPathIds: readonly string[],
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): void {
    const clips = clipPathIds
      .map((id) => this.clipPath(id))
      .filter((path): path is Path2D => path !== null);

    if (clips.length === 0) {
      draw(ctx);
      return;
    }
    for (const clip of clips) {
      ctx.save();
      ctx.clip(clip);
      draw(ctx);
      ctx.restore();
    }
  }

  private clipPath(id: string): Path2D | null {
    const cached = this.clipPathCache.get(id);
    if (cached) return cached;
    const d = this.clipPathData[id];
    if (d === undefined) return null;
    const path = new Path2D(d);
    this.clipPathCache.set(id, path);
    return path;
  }
}
