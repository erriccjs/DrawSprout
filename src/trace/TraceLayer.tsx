/**
 * The photo under the drawing. It is sized with the paper, so zoom and pan
 * of the paper move it together with the lines. While it is locked it ignores
 * the pointer.
 */

import { useEffect, useRef } from 'react';
import { backingSize } from '../renderer/coordinates';
import type { Viewport } from '../renderer/types';
import { paintTracePhoto } from './paint';
import type { TracePlacement } from './placement';

interface TraceLayerProps {
  readonly image: HTMLImageElement;
  readonly placement: TracePlacement;
  readonly opacity: number;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly viewport: Viewport;
  readonly spaceWidth: number;
  readonly onMove: (dx: number, dy: number) => void;
}

export function TraceLayer({
  image,
  placement,
  opacity,
  visible,
  locked,
  viewport,
  spaceWidth,
  onMove,
}: TraceLayerProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { width, height } = backingSize(viewport);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${viewport.cssWidth}px`;
    canvas.style.height = `${viewport.cssHeight}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!visible) return;
    paintTracePhoto(ctx, image, placement, opacity, viewport.scale);
  }, [image, placement, opacity, visible, viewport]);

  return (
    <canvas
      ref={ref}
      className="stage__photo"
      data-locked={locked}
      aria-hidden="true"
      onPointerDown={(event) => {
        if (locked) return;
        drag.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || locked) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const unit = spaceWidth / Math.max(1, rect.width);
        onMove((event.clientX - start.x) * unit, (event.clientY - start.y) * unit);
        drag.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    />
  );
}
