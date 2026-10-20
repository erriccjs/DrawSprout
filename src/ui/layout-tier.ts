/**
 * Which layout the shell should use.
 *
 * Tablet landscape is still the primary design (PRD section 10). Phones get a
 * separate tier so a 360–430px portrait, or a short phone landscape, does not
 * inherit the tablet column widths. The cutoffs match the phone rules in
 * `src/styles.css` and the measurements in `docs/TABLET_LAYOUT_FIT.md`.
 *
 * - Portrait phones are at most 599px wide. The narrowest measured tablet
 *   portrait is 600px, so that row stays on the tablet layout.
 * - Phone landscape is a short viewport (at most 480px, covering 360–430 with
 *   a margin) that is also no wider than 940px. A short tablet such as
 *   1024×430 or 960×600 stays on the tablet rules.
 */

export const PHONE_PORTRAIT_MAX_WIDTH = 599;
export const PHONE_LANDSCAPE_MAX_HEIGHT = 480;
export const PHONE_LANDSCAPE_MAX_WIDTH = 940;

export type LayoutTier = 'phone-portrait' | 'phone-landscape' | 'tablet';

export function layoutTier(width: number, height: number): LayoutTier {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'tablet';
  }
  if (width <= PHONE_PORTRAIT_MAX_WIDTH) {
    return width > height ? 'phone-landscape' : 'phone-portrait';
  }
  if (
    width > height &&
    height <= PHONE_LANDSCAPE_MAX_HEIGHT &&
    width <= PHONE_LANDSCAPE_MAX_WIDTH
  ) {
    return 'phone-landscape';
  }
  return 'tablet';
}
