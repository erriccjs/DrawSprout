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
import type { InputMode } from '../lesson-engine/types';
import { clampToSpace, clientToSpace } from '../renderer/coordinates';
import type { Point, RenderSpace } from '../renderer/types';
import { initialGestureState, reduceGesture, type PinchGesture } from './gesture-tracker';

export type StrokeEndReason = 'up' | 'cancel';

export interface StrokeInputCallbacks {
  /** `false` ignores the pointer entirely; used for the pencil/finger filter. */
  accepts(pointerType: string): boolean;
  /** Which gestures may draw and which are free for fingers. */
  inputMode: InputMode;
  begin(point: Point, event: PointerEvent): void;
  extend(point: Point, event: PointerEvent): void;
  end(reason: StrokeEndReason): void;
  /** Called when a pointer is refused, so the UI can explain why. */
  rejected?(pointerType: string): void;
  /** Drops the banner once a refused touch turns out to be a gesture. */
  clearRejection?(): void;
  /** Drops the in-progress stroke without committing it. */
  discard?(): void;
  undo?(): void;
  redo?(): void;
  /** Two-finger move that has left the tap window. Optional until the view uses it. */
  pinch?(gesture: PinchGesture): void;
}

export function useStrokeInput(
  canvas: HTMLCanvasElement | null,
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

  const gestureRef = useRef(initialGestureState);

  useEffect(() => {
    // The element itself is the dependency, so a canvas that remounts - after
    // the finish screen is dismissed, say - gets its own listeners instead of
    // silently going deaf.
    if (!canvas) return;
    gestureRef.current = initialGestureState;

    const toPoint = (event: PointerEvent): Point =>
      clampToSpace(space, clientToSpace(space, canvas.getBoundingClientRect(), event.clientX, event.clientY));

    const apply = (kind: 'down' | 'move' | 'up' | 'cancel', event: PointerEvent) => {
      const callbacks = callbacksRef.current;
      const step = reduceGesture(
        gestureRef.current,
        {
          type: kind,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        },
        { inputMode: callbacks.inputMode, accepts: (pointerType) => callbacks.accepts(pointerType) },
      );
      gestureRef.current = step.state;

      for (const command of step.commands) {
        switch (command.type) {
          case 'draw-begin':
            callbacks.begin(toPoint(event), event);
            break;
          case 'draw-move': {
            event.preventDefault();
            // Coalesced events give every sample the digitiser produced
            // between frames. The event itself is used when that is missing.
            const samples =
              typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
            if (samples.length === 0) {
              callbacks.extend(toPoint(event), event);
              break;
            }
            for (const sample of samples) callbacks.extend(toPoint(sample), sample);
            break;
          }
          case 'draw-end':
            callbacks.end(command.reason);
            break;
          case 'draw-discard':
            callbacks.discard?.();
            break;
          case 'reject':
            callbacks.rejected?.(event.pointerType);
            break;
          case 'clear-rejection':
            callbacks.clearRejection?.();
            break;
          case 'undo':
            callbacks.undo?.();
            break;
          case 'redo':
            callbacks.redo?.();
            break;
          case 'pinch':
            callbacks.pinch?.(command);
            break;
          default:
            break;
        }
      }
    };

    const release = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onPointerDown = (event: PointerEvent) => {
      apply('down', event);
      // The canvas sets `touch-action: none`, so this only suppresses text
      // selection and the synthetic mouse events, not page-level gestures.
      event.preventDefault();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Already gone, or capture is unsupported. The stroke still stands.
      }
    };
    const onPointerMove = (event: PointerEvent) => apply('move', event);
    const onPointerUp = (event: PointerEvent) => {
      apply('up', event);
      release(event);
    };
    const onPointerCancel = (event: PointerEvent) => {
      apply('cancel', event);
      release(event);
    };

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
  }, [canvas, space]);
}
