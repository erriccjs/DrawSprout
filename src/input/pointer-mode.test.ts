/**
 * Pencil/finger input filter (FR-22).
 *
 * This is the whole of what the app promises about input types. It is not palm
 * rejection, and the tests say nothing about whether a resting hand is
 * suppressed on real hardware — that is AT-16, which needs a tablet.
 */

import { describe, expect, it } from 'vitest';
import { acceptsPointerType, rejectionMessage } from './pointer-mode';

describe('pencil mode', () => {
  it('accepts the pen digitiser only', () => {
    expect(acceptsPointerType('pencil', 'pen')).toBe(true);
    expect(acceptsPointerType('pencil', 'touch')).toBe(false);
    expect(acceptsPointerType('pencil', 'mouse')).toBe(false);
  });

  it('explains why a touch did not draw instead of failing silently', () => {
    expect(rejectionMessage('pencil', 'touch')).toMatch(/mode pensil/i);
    expect(rejectionMessage('pencil', 'pen')).toBeNull();
  });
});

describe('finger mode', () => {
  it('accepts touch, and mouse so a desktop browser can run the flow', () => {
    expect(acceptsPointerType('finger', 'touch')).toBe(true);
    expect(acceptsPointerType('finger', 'mouse')).toBe(true);
  });

  it('does not accept a pen, so the two modes stay distinguishable', () => {
    expect(acceptsPointerType('finger', 'pen')).toBe(false);
    expect(rejectionMessage('finger', 'pen')).toMatch(/mode jari/i);
  });

  it('ignores an unknown pointer type rather than guessing', () => {
    expect(acceptsPointerType('finger', 'eraser-barrel')).toBe(false);
    expect(acceptsPointerType('pencil', '')).toBe(false);
  });
});
