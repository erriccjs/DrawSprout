/**
 * Pointer handling for the drawing surface.
 *
 * Native listeners rather than React props, and no state updates in the move
 * path: a pointermove reaches the renderer directly, so drawing never waits on
 * a React render (PRD section 11).
 *
 * The rules this enforces come from PRD section 11 and AT-17:
 *  - exactly one pointer draws at a time; a second finger or a palm that lands
 *    mid-stroke is ignored rather than starting a second line;
 *  - the canvas captures the pointer, so a stroke that leaves the canvas keeps
 *    reporting instead of ending halfway;
 *  - `pointercancel` ends the stroke like a lift, so the next pointerdown can
 *    never be joined to the cancelled one by a long connecting line.
 */

import { useEffect, useRef } from 'react';
import { clampToSpace, clientToSpace } from '../renderer/coordinates';
import type { Point, RenderSpace } from '../renderer/types';

export type StrokeEndReason = 'up' | 'cancel';

export interface StrokeInputCallbacks {
  /** `false` ignores the pointer entirely; used for the pencil/finger filter. */
  accepts(pointerType: string): boolean;
  begin(point: Point, event: PointerEvent): void;
  extend(point: Point, event: PointerEvent): void;
  end(reason: StrokeEndReason): void;
  /** Called when a pointer is refused, so the UI can explain why. */
  rejected?(pointerType: string): void;
}

export function useStrokeInput(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  space: RenderSpace,
  callbacks: StrokeInputCallbacks,
): void {
  // Read through a ref so changing a callback never re-subscribes the
  // listeners mid-stroke.
  const callbacksRef = useRef(callbacks);
  // Declared before the listener effect so the ref is current by the time any
  // listener can fire. The initial value already comes from this render.
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const activePointerRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toPoint = (event: PointerEvent): Point =>
      clampToSpace(space, clientToSpace(space, canvas.getBoundingClientRect(), event.clientX, event.clientY));

    const finish = (reason: StrokeEndReason, pointerId: number) => {
      if (activePointerRef.current !== pointerId) return;
      activePointerRef.current = null;
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      callbacksRef.current.end(reason);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!callbacksRef.current.accepts(event.pointerType)) {
        callbacksRef.current.rejected?.(event.pointerType);
        return;
      }
      // One stroke at a time. A palm or second finger arriving mid-stroke is
      // dropped; it does not steal or fork the line being drawn.
      if (activePointerRef.current !== null) return;

      activePointerRef.current = event.pointerId;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // The spec lets this throw when the pointer is already gone. Capture
        // only matters for a stroke that leaves the canvas, so drawing without
        // it is better than refusing the stroke.
      }
      // The canvas sets `touch-action: none`, so this only suppresses text
      // selection and the synthetic mouse events, not page-level gestures.
      event.preventDefault();
      callbacksRef.current.begin(toPoint(event), event);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (activePointerRef.current !== event.pointerId) return;
      event.preventDefault();

      // Coalesced events give every sample the digitiser produced between
      // frames, which matters for fast strokes on a high-rate pen. Purely an
      // optimisation: the event itself is used when it is unavailable.
      const samples =
        typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
      if (samples.length === 0) {
        callbacksRef.current.extend(toPoint(event), event);
        return;
      }
      for (const sample of samples) {
        callbacksRef.current.extend(toPoint(sample), sample);
      }
    };

    const onPointerUp = (event: PointerEvent) => finish('up', event.pointerId);
    const onPointerCancel = (event: PointerEvent) => finish('cancel', event.pointerId);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    // With pointer capture the browser may report a lost capture instead of an
    // up; without this the pointer id would stay active and wedge all input.
    canvas.addEventListener('lostpointercapture', onPointerCancel);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('lostpointercapture', onPointerCancel);
    };
  }, [canvasRef, space]);
}
