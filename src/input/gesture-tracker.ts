/**
 * Multi-touch gestures on the drawing surface.
 *
 * Two fingers tap to undo, three tap to redo. A pinch is the same two fingers
 * moving apart or together, so the thresholds overlap on purpose: a little
 * wobble is still a tap, and a real pinch is not.
 *
 * The tracker is pure. It does not know about React, the canvas, or the
 * session. The pointer hook turns its commands into drawing, undo, or a view
 * change.
 */

import type { InputMode } from '../lesson-engine/types';

/** A tap that lasts longer than this is a hold, not undo or redo. */
export const TAP_MAX_DURATION_MS = 320;
/** How far one finger may drift and still count as a tap. */
export const TAP_MAX_TRAVEL_PX = 24;
/** Fingers of one tap have to land this close together in time. */
export const TAP_CLUSTER_MS = 180;
/**
 * Separation or midpoint movement past this arms a pinch instead of a tap.
 * It sits above the per-finger tap travel so a small wobble is not a pinch.
 */
export const GESTURE_ARM_PX = 36;

export interface GesturePointerEvent {
  readonly type: 'down' | 'move' | 'up' | 'cancel';
  readonly pointerId: number;
  readonly pointerType: string;
  readonly x: number;
  readonly y: number;
  readonly time: number;
}

export interface GestureWorld {
  readonly inputMode: InputMode;
  readonly accepts: (pointerType: string) => boolean;
}

export interface PinchGesture {
  readonly type: 'pinch';
  readonly distance: number;
  readonly midX: number;
  readonly midY: number;
  readonly startDistance: number;
  readonly startMidX: number;
  readonly startMidY: number;
}

export type GestureCommand =
  | { readonly type: 'draw-begin' }
  | { readonly type: 'draw-move' }
  | { readonly type: 'draw-end'; readonly reason: 'up' | 'cancel' }
  | { readonly type: 'draw-discard' }
  | { readonly type: 'reject' }
  | { readonly type: 'clear-rejection' }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | PinchGesture;

interface TrackedPointer {
  readonly id: number;
  readonly pointerType: string;
  readonly x: number;
  readonly y: number;
  readonly originX: number;
  readonly originY: number;
  readonly downAt: number;
  readonly maxTravel: number;
  readonly upAt: number | null;
}

interface PinchBaseline {
  readonly distance: number;
  readonly midX: number;
  readonly midY: number;
}

export interface GestureState {
  readonly pointers: readonly TrackedPointer[];
  /** The pointer currently laying down ink, if any. */
  readonly drawId: number | null;
  /** Pointers in the multi-touch gesture, including ones that already lifted. */
  readonly gestureIds: readonly number[];
  readonly gestureStartedAt: number | null;
  /** Movement has left the tap window, so lift must not undo or redo. */
  readonly armed: boolean;
  readonly pinch: PinchBaseline | null;
}

export const initialGestureState: GestureState = {
  pointers: [],
  drawId: null,
  gestureIds: [],
  gestureStartedAt: null,
  armed: false,
  pinch: null,
};

export interface GestureStep {
  readonly state: GestureState;
  readonly commands: readonly GestureCommand[];
}

export function reduceGesture(
  state: GestureState,
  event: GesturePointerEvent,
  world: GestureWorld,
): GestureStep {
  switch (event.type) {
    case 'down':
      return onDown(state, event, world);
    case 'move':
      return onMove(state, event);
    case 'up':
      return onUp(state, event, 'up');
    case 'cancel':
      return onUp(state, event, 'cancel');
    default:
      return { state, commands: [] };
  }
}

function onDown(state: GestureState, event: GesturePointerEvent, world: GestureWorld): GestureStep {
  if (state.pointers.some((pointer) => pointer.id === event.pointerId && pointer.upAt === null)) {
    return { state, commands: [] };
  }
  const pointer = track(event);
  const withPointer: GestureState = { ...state, pointers: [...state.pointers, pointer] };

  // A second pen must not fork the stroke or turn it into a finger gesture.
  if (state.drawId !== null && world.inputMode === 'pencil' && world.accepts(event.pointerType)) {
    return { state: withPointer, commands: [] };
  }

  if (state.drawId !== null && world.inputMode === 'finger' && world.accepts(event.pointerType)) {
    // The first finger may already have laid a dot. A multi-finger gesture
    // drops it, so the tap cannot leave ink or a line into the next stroke.
    return {
      state: startGesture(withPointer, event, state.drawId),
      commands: [{ type: 'draw-discard' }],
    };
  }

  if (!world.accepts(event.pointerType)) {
    const joining = state.gestureIds.length > 0;
    return {
      state: startGesture(withPointer, event, null),
      commands: [joining ? { type: 'clear-rejection' } : { type: 'reject' }],
    };
  }

  if (state.gestureIds.length > 0) {
    return { state: startGesture(withPointer, event, null), commands: [] };
  }

  return {
    state: { ...withPointer, drawId: event.pointerId },
    commands: [{ type: 'draw-begin' }],
  };
}

function onMove(state: GestureState, event: GesturePointerEvent): GestureStep {
  const current = state.pointers.find((pointer) => pointer.id === event.pointerId && pointer.upAt === null);
  if (!current) return { state, commands: [] };

  const moved = withTravel(current, event.x, event.y);
  let next: GestureState = {
    ...state,
    pointers: state.pointers.map((pointer) => (pointer.id === event.pointerId && pointer.upAt === null ? moved : pointer)),
  };
  const commands: GestureCommand[] = [];
  if (state.drawId === event.pointerId) commands.push({ type: 'draw-move' });

  if (next.gestureIds.includes(event.pointerId)) {
    if (moved.maxTravel > TAP_MAX_TRAVEL_PX) next = { ...next, armed: true };
    const live = gestureLive(next);
    if (live.length >= 2) {
      const baseline = next.pinch ?? measure(live[0]!, live[1]!);
      const now = measure(live[0]!, live[1]!);
      const spread = Math.abs(now.distance - baseline.distance);
      const pan = Math.hypot(now.midX - baseline.midX, now.midY - baseline.midY);
      if (spread >= GESTURE_ARM_PX || pan >= GESTURE_ARM_PX) next = { ...next, armed: true };
      if (next.pinch === null) next = { ...next, pinch: baseline };
      if (next.armed && next.drawId === null) {
        commands.push({
          type: 'pinch',
          distance: now.distance,
          midX: now.midX,
          midY: now.midY,
          startDistance: baseline.distance,
          startMidX: baseline.midX,
          startMidY: baseline.midY,
        });
      }
    }
  }

  return { state: next, commands };
}

function onUp(state: GestureState, event: GesturePointerEvent, reason: 'up' | 'cancel'): GestureStep {
  const current = state.pointers.find((pointer) => pointer.id === event.pointerId && pointer.upAt === null);
  if (!current) return { state, commands: [] };

  const finished = withTravel({ ...current, upAt: event.time }, event.x, event.y);
  let next: GestureState = {
    ...state,
    pointers: state.pointers.map((pointer) => (pointer.id === event.pointerId && pointer.upAt === null ? finished : pointer)),
  };
  const commands: GestureCommand[] = [];

  if (reason === 'cancel') next = { ...next, armed: true };

  if (state.drawId === event.pointerId) {
    commands.push({ type: 'draw-end', reason });
    next = { ...next, drawId: null };
  }

  if (next.gestureIds.length > 0 && gestureLive(next).length === 0) {
    const resolved = resolveTap(next, event.time);
    commands.push(...resolved.commands);
    next = resolved.state;
  } else {
    next = {
      ...next,
      pointers: next.pointers.filter(
        (pointer) => pointer.upAt === null || next.gestureIds.includes(pointer.id),
      ),
    };
  }

  return { state: next, commands };
}

function startGesture(state: GestureState, event: GesturePointerEvent, formerDrawId: number | null): GestureState {
  const ids = unique([
    ...(formerDrawId === null ? [] : [formerDrawId]),
    ...state.gestureIds,
    event.pointerId,
  ]);
  const startedAt =
    state.gestureStartedAt ??
    state.pointers.find((pointer) => pointer.id === ids[0])?.downAt ??
    event.time;
  const pinched = ids.length >= 2 ? measureLive(state.pointers, ids) : state.pinch;
  return {
    ...state,
    drawId: formerDrawId === null ? state.drawId : null,
    gestureIds: ids,
    gestureStartedAt: startedAt,
    pinch: pinched ?? state.pinch,
  };
}

function resolveTap(state: GestureState, now: number): GestureStep {
  const people = state.pointers.filter((pointer) => state.gestureIds.includes(pointer.id));
  const startedAt = state.gestureStartedAt ?? now;
  const duration = now - startedAt;
  const travelOk = people.every((pointer) => pointer.maxTravel <= TAP_MAX_TRAVEL_PX);
  const clusterOk = people.every((pointer) => pointer.downAt - startedAt <= TAP_CLUSTER_MS);
  const commands: GestureCommand[] = [];
  if (!state.armed && travelOk && clusterOk && duration <= TAP_MAX_DURATION_MS) {
    if (people.length === 2) commands.push({ type: 'undo' });
    else if (people.length === 3) commands.push({ type: 'redo' });
  }
  return {
    state: {
      ...initialGestureState,
      drawId: state.drawId,
      pointers: state.pointers.filter((pointer) => pointer.upAt === null && pointer.id === state.drawId),
    },
    commands,
  };
}

function track(event: GesturePointerEvent): TrackedPointer {
  return {
    id: event.pointerId,
    pointerType: event.pointerType,
    x: event.x,
    y: event.y,
    originX: event.x,
    originY: event.y,
    downAt: event.time,
    maxTravel: 0,
    upAt: null,
  };
}

function withTravel(pointer: TrackedPointer, x: number, y: number): TrackedPointer {
  const travel = Math.hypot(x - pointer.originX, y - pointer.originY);
  return { ...pointer, x, y, maxTravel: Math.max(pointer.maxTravel, travel) };
}

function gestureLive(state: GestureState): readonly TrackedPointer[] {
  return state.pointers.filter((pointer) => state.gestureIds.includes(pointer.id) && pointer.upAt === null);
}

function measureLive(pointers: readonly TrackedPointer[], ids: readonly number[]): PinchBaseline | null {
  const live = pointers.filter((pointer) => ids.includes(pointer.id) && pointer.upAt === null);
  if (live.length < 2) return null;
  return measure(live[0]!, live[1]!);
}

function measure(a: TrackedPointer, b: TrackedPointer): PinchBaseline {
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
  };
}

function unique(ids: readonly number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
