/**
 * How much of the stage the paper must stay out of.
 *
 * The step reference (instruction, dots, example) sits under the header.
 * Lanjut and Kembali sit on the bottom edge. These numbers match the
 * positions in `src/styles.css` so the fitted paper, and its guides, land
 * in the band between them.
 */

import { EDGE_DEAD_ZONE_PX } from '../input/edge-guard';
import type { LayoutTier } from './layout-tier';

export interface DrawingChrome {
  readonly top: number;
  readonly bottom: number;
  /** Paper stays this far from the left and right screen edges. */
  readonly side: number;
}

/**
 * Landscape-tablet sample card. The pad slides the sheet right of this edge.
 * The width matches `.step-reference--card` in `src/styles.css`.
 */
export const TABLET_REFERENCE_CARD_RIGHT = 8 + 200 + 12;

/** Visual margin on a portrait phone. Finger strokes still stop 28px from the screen edge. */
export const PHONE_PORTRAIT_SIDE = 8;

export function drawingChrome(layout: LayoutTier, noticeOpen: boolean): DrawingChrome {
  const side = EDGE_DEAD_ZONE_PX;
  if (layout === 'phone-portrait') {
    // Just under the step card (and the tablet note when it is open). The
    // tools follow the sheet, so the bottom reserve is only the Lanjut bar.
    // A small side margin lets the 4:3 sheet use the screen width.
    return { top: noticeOpen ? 208 : 136, bottom: 80, side: PHONE_PORTRAIT_SIDE };
  }
  if (layout === 'phone-landscape') {
    return { top: noticeOpen ? 156 : 112, bottom: 64, side };
  }
  // Header row, then the open step card. Bottom bar is the large Lanjut.
  return { top: 168, bottom: 96, side };
}
