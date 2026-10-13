/**
 * Which pointer types are allowed to draw (FR-22).
 *
 * Pure so the rule can be tested and read without a browser.
 */

import type { InputMode } from '../lesson-engine/types';

/**
 * Pencil mode accepts the pen digitiser only. Finger mode accepts touch, and
 * also mouse so a desktop browser can run the flow for QA (PRD section 21
 * lists desktop as basic QA, not a UX target).
 *
 * This is an input filter, not palm rejection. A palm that the digitiser
 * reports as `touch` is simply not accepted as a stroke in pencil mode; the
 * app makes no claim about whether the OS or the panel suppresses it, and that
 * behaviour (AT-16) can only be judged on real hardware.
 */
export function acceptsPointerType(mode: InputMode, pointerType: string): boolean {
  if (mode === 'pencil') return pointerType === 'pen';
  return pointerType === 'touch' || pointerType === 'mouse';
}

/** Short explanation shown when a pointer is ignored, so nothing feels broken. */
export function rejectionMessage(mode: InputMode, pointerType: string): string | null {
  if (acceptsPointerType(mode, pointerType)) return null;
  if (mode === 'pencil') return 'Mode pensil: gambar dengan stylus, atau pindah ke mode jari.';
  return 'Mode jari: gambar dengan jari, atau pindah ke mode pensil.';
}
