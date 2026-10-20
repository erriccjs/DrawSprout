import { describe, expect, it } from 'vitest';
import type { InputMode } from '../lesson-engine/types';
import {
  GESTURE_ARM_PX,
  TAP_CLUSTER_MS,
  TAP_MAX_DURATION_MS,
  TAP_MAX_TRAVEL_PX,
  initialGestureState,
  reduceGesture,
  type GestureCommand,
  type GesturePointerEvent,
  type GestureState,
  type GestureWorld,
} from './gesture-tracker';

function world(mode: InputMode): GestureWorld {
  return {
    inputMode: mode,
    accepts: (pointerType) => (mode === 'pencil' ? pointerType === 'pen' : pointerType === 'touch' || pointerType === 'mouse'),
  };
}

function play(mode: InputMode, events: readonly GesturePointerEvent[]): { state: GestureState; commands: GestureCommand[] } {
  let state = initialGestureState;
  const commands: GestureCommand[] = [];
  for (const event of events) {
    const step = reduceGesture(state, event, world(mode));
    state = step.state;
    commands.push(...step.commands);
  }
  return { state, commands };
}

function pointer(
  type: GesturePointerEvent['type'],
  id: number,
  x: number,
  y: number,
  time: number,
  pointerType = 'touch',
): GesturePointerEvent {
  return { type, pointerId: id, pointerType, x, y, time };
}

function tap(ids: readonly number[], at = 0): GesturePointerEvent[] {
  return [
    ...ids.map((id, index) => pointer('down', id, 100 + index * 48, 200, at + index * 20)),
    ...ids.map((id, index) => pointer('up', id, 104 + index * 48, 203, at + 80 + index)),
  ];
}

describe('gesture recognition', () => {
  it('treats a two-finger tap as undo and a three-finger tap as redo', () => {
    const two = play('finger', tap([1, 2]));
    expect(two.commands.map((command) => command.type)).toEqual(['draw-begin', 'draw-discard', 'undo']);

    const three = play('finger', tap([1, 2, 3]));
    expect(three.commands.map((command) => command.type)).toEqual(['draw-begin', 'draw-discard', 'redo']);
  });

  it('still recognises a tap when each finger drifts a little', () => {
    const events = play('finger', [
      pointer('down', 1, 80, 80, 0),
      pointer('down', 2, 140, 80, 30),
      pointer('move', 1, 80 + TAP_MAX_TRAVEL_PX - 1, 80, 60),
      pointer('move', 2, 140, 80 + TAP_MAX_TRAVEL_PX - 1, 70),
      pointer('up', 1, 80 + TAP_MAX_TRAVEL_PX - 1, 82, 120),
      pointer('up', 2, 142, 80 + TAP_MAX_TRAVEL_PX - 1, 130),
    ]);
    expect(events.commands.at(-1)?.type).toBe('undo');
    expect(events.commands.some((command) => command.type === 'pinch')).toBe(false);
  });

  it('does not treat a pinch or a slow press as a tap', () => {
    const pinch = play('finger', [
      pointer('down', 1, 100, 100, 0),
      pointer('down', 2, 160, 100, 20),
      pointer('move', 2, 160 + GESTURE_ARM_PX + 20, 100, 80),
      pointer('up', 2, 160 + GESTURE_ARM_PX + 20, 100, 140),
      pointer('up', 1, 100, 100, 150),
    ]);
    expect(pinch.commands.some((command) => command.type === 'undo' || command.type === 'redo')).toBe(false);
    expect(pinch.commands.some((command) => command.type === 'pinch')).toBe(true);
    expect(pinch.commands.some((command) => command.type === 'draw-discard')).toBe(true);

    const slow = play('finger', [
      pointer('down', 1, 100, 100, 0),
      pointer('down', 2, 150, 100, 40),
      pointer('up', 1, 100, 100, TAP_MAX_DURATION_MS + 40),
      pointer('up', 2, 150, 100, TAP_MAX_DURATION_MS + 50),
    ]);
    expect(slow.commands.some((command) => command.type === 'undo')).toBe(false);

    const late = play('finger', [
      pointer('down', 1, 100, 100, 0),
      pointer('down', 2, 150, 100, TAP_CLUSTER_MS + 40),
      pointer('up', 1, 102, 102, TAP_CLUSTER_MS + 80),
      pointer('up', 2, 152, 102, TAP_CLUSTER_MS + 90),
    ]);
    expect(late.commands.some((command) => command.type === 'undo')).toBe(false);
  });

  it('discards the finger stroke when a second finger lands, and leaves a pencil stroke alone', () => {
    const finger = play('finger', [
      pointer('down', 1, 10, 10, 0, 'mouse'),
      pointer('move', 1, 40, 30, 30, 'mouse'),
      pointer('down', 2, 80, 80, 40, 'mouse'),
    ]);
    expect(finger.commands.map((command) => command.type)).toEqual(['draw-begin', 'draw-move', 'draw-discard']);
    expect(finger.state.drawId).toBeNull();

    const pencil = play('pencil', [
      pointer('down', 7, 10, 10, 0, 'pen'),
      pointer('move', 7, 30, 20, 20, 'pen'),
      pointer('down', 8, 90, 90, 30, 'touch'),
      pointer('down', 9, 130, 90, 50, 'touch'),
      pointer('up', 8, 92, 92, 90, 'touch'),
      pointer('up', 9, 132, 92, 100, 'touch'),
    ]);
    expect(pencil.commands.some((command) => command.type === 'draw-discard')).toBe(false);
    expect(pencil.commands.some((command) => command.type === 'draw-end')).toBe(false);
    expect(pencil.state.drawId).toBe(7);
    expect(pencil.commands.map((command) => command.type)).toContain('undo');
    expect(pencil.commands).toContainEqual({ type: 'reject' });
    expect(pencil.commands).toContainEqual({ type: 'clear-rejection' });
  });

  it('ends a cancelled drawing pointer without turning it into undo', () => {
    const cancelled = play('finger', [
      pointer('down', 1, 10, 10, 0),
      pointer('move', 1, 20, 20, 10),
      pointer('cancel', 1, 20, 20, 20),
    ]);
    expect(cancelled.commands.map((command) => command.type)).toEqual(['draw-begin', 'draw-move', 'draw-end']);
    expect(cancelled.commands.at(-1)).toEqual({ type: 'draw-end', reason: 'cancel' });
  });
});
