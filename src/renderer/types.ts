/**
 * Renderer types.
 *
 * The renderer knows about geometry, layers and canvases. It deliberately knows
 * nothing about lessons, steps, assistance modes or completion: a clip path is
 * an opaque id, and a stroke is points plus paint. The UI adapts engine data
 * into these shapes (see `src/ui/render-adapter.ts`).
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The fixed coordinate space all incoming geometry is expressed in. */
export interface RenderSpace {
  readonly width: number;
  readonly height: number;
}

/** `color` composites below `ink`, so outlines stay readable over paint. */
export type RenderLayer = 'color' | 'ink';

export interface RenderStroke {
  readonly points: readonly Point[];
  readonly color: string;
  /** Width in coordinate-space units. */
  readonly width: number;
  readonly layer: RenderLayer;
  /** `true` cuts out of the layer instead of adding to it. */
  readonly erase: boolean;
  /**
   * When set, an eraser cuts both the ink layer and the colour layer. Used for
   * free drawing, where a stroke is not tied to one lesson phase.
   */
  readonly eraseAll?: boolean;
  /**
   * Ids registered via `setClipPaths`. When non-empty the stroke is confined to
   * the union of those paths. Empty means unconstrained.
   */
  readonly clipPathIds: readonly string[];
}

/** A stroke that is still under the pointer. */
export type LiveStrokeSpec = Omit<RenderStroke, 'points'>;

/** How the geometry is mapped onto a canvas backing store. */
export interface Viewport {
  /** Canvas size in CSS pixels. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Device pixels per CSS pixel, already clamped. */
  readonly dpr: number;
  /** Device pixels per coordinate-space unit. */
  readonly scale: number;
}

/** Minimal canvas surface the renderer needs; lets tests inject a fake. */
export interface RenderTarget {
  readonly width: number;
  readonly height: number;
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
}

export type CanvasFactory = (widthPx: number, heightPx: number) => HTMLCanvasElement;
