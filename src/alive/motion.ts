/**
 * How one part of a finished picture moves.
 *
 * Time runs from 0 to 1 across one short play. These functions are pure, so a
 * test can check a blink or a wag without a canvas. A transform is applied
 * later to the child's own strokes.
 */

import type { CoordinateSpace } from '../lesson-data/schema';

/** Long enough to notice, short enough to rest a cheap phone. */
export const ALIVE_MS = 4200;

export type MotionKind = 'still' | 'wag' | 'blink' | 'swim' | 'spin' | 'sway' | 'flap' | 'bob' | 'bounce';

export interface AlivePoint {
  readonly x: number;
  readonly y: number;
}

export interface Transform2D {
  readonly translateX: number;
  readonly translateY: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly alpha: number;
  readonly pivotX: number;
  readonly pivotY: number;
}

export function identityAt(pivot: AlivePoint = { x: 0, y: 0 }): Transform2D {
  return {
    translateX: 0,
    translateY: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    pivotX: pivot.x,
    pivotY: pivot.y,
  };
}

/** A transform for `motion` at progress `t` (0 to 1). */
export function transformAt(motion: MotionKind, t: number, pivot: AlivePoint, space: CoordinateSpace): Transform2D {
  const base = identityAt(pivot);
  const clamped = Math.min(1, Math.max(0, t));
  if (motion === 'wag') return { ...base, rotation: Math.sin(clamped * Math.PI * 4) * 0.22 };
  if (motion === 'blink') return { ...base, scaleY: blinkScale(clamped) };
  if (motion === 'swim') {
    const wave = Math.sin(clamped * Math.PI * 3);
    return {
      ...base,
      pivotX: space.width / 2,
      pivotY: space.height / 2,
      translateX: wave * 36,
      translateY: Math.sin(clamped * Math.PI * 6) * 8,
      rotation: wave * 0.05,
    };
  }
  if (motion === 'spin') {
    return {
      ...base,
      pivotX: space.width / 2,
      pivotY: space.height / 2,
      rotation: clamped * Math.PI * 1.5,
    };
  }
  if (motion === 'sway') return { ...base, rotation: Math.sin(clamped * Math.PI * 2) * 0.12 };
  if (motion === 'flap') return { ...base, rotation: Math.sin(clamped * Math.PI * 6) * 0.28 };
  if (motion === 'bob') return { ...base, translateY: Math.sin(clamped * Math.PI * 2) * -8 };
  if (motion === 'bounce') {
    return {
      ...base,
      pivotX: space.width / 2,
      pivotY: space.height / 2,
      translateY: Math.sin(clamped * Math.PI * 2) * -12,
    };
  }
  return base;
}

function blinkScale(t: number): number {
  const pulse = (center: number) => {
    const distance = Math.abs(t - center);
    if (distance > 0.06) return 1;
    return 0.2 + 0.8 * (distance / 0.06);
  };
  return Math.min(pulse(0.28), pulse(0.62));
}

/** Strokes appear in order during the first part of a fallback play. */
export function strokeRevealed(index: number, count: number, t: number): boolean {
  if (count <= 0) return false;
  const reveal = Math.min(1, Math.max(0, t) / 0.72);
  return index < Math.ceil(reveal * count);
}
