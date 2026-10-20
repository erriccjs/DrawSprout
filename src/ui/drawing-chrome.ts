/**
 * How much of the stage the paper must stay out of.
 *
 * The step reference (instruction, dots, example) sits under the header.
 * Lanjut and Kembali sit on the bottom edge. These numbers match the
 * positions in `src/styles.css` so the fitted paper, and its guides, land
 * in the band between them.
 */

import type { LayoutTier } from './layout-tier';

export interface DrawingChrome {
  readonly top: number;
  readonly bottom: number;
}

export function drawingChrome(layout: LayoutTier, noticeOpen: boolean): DrawingChrome {
  if (layout === 'phone-portrait') {
    // Header, then the tablet note when it is open, then the folded step card.
    return { top: noticeOpen ? 188 : 124, bottom: 128 };
  }
  if (layout === 'phone-landscape') {
    return { top: noticeOpen ? 156 : 112, bottom: 64 };
  }
  // Header row, then the open step card. Bottom bar is the large Lanjut.
  return { top: 168, bottom: 96 };
}
