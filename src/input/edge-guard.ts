/**
 * Finger-mode contact filters for a hand resting on a touchscreen.
 *
 * These are page-level guesses from the pointer event. They are not the
 * operating system's palm rejection, and they cannot cancel an Android
 * system gesture that the browser never delivers to the page.
 */

/** Strokes do not start inside this CSS-pixel margin of the viewport. */
export const EDGE_DEAD_ZONE_PX = 28;

/**
 * A contact this wide or tall is treated as a palm, not a finger.
 * Browsers that do not report contact size send 0 or 1, which is not a palm.
 */
export const PALM_CONTACT_PX = 80;

export function isPalmContact(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width <= 1 && height <= 1) return false;
  return width >= PALM_CONTACT_PX || height >= PALM_CONTACT_PX;
}

export function isScreenEdge(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  inset = EDGE_DEAD_ZONE_PX,
): boolean {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;
  if (viewportWidth <= inset * 2 || viewportHeight <= inset * 2) return false;
  return (
    clientX < inset ||
    clientY < inset ||
    clientX > viewportWidth - inset ||
    clientY > viewportHeight - inset
  );
}

export type FingerTouchVerdict = 'ok' | 'palm' | 'edge';

/**
 * Finger mode only, and only for real touches. Mouse stays available at the
 * window edge so desktop QA can draw a full stroke. Pencil mode is not
 * filtered here.
 */
export function fingerTouchGuard(input: {
  readonly pointerType: string;
  readonly clientX: number;
  readonly clientY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly contactWidth: number;
  readonly contactHeight: number;
}): FingerTouchVerdict {
  if (input.pointerType !== 'touch') return 'ok';
  if (isPalmContact(input.contactWidth, input.contactHeight)) return 'palm';
  if (
    isScreenEdge(input.clientX, input.clientY, input.viewportWidth, input.viewportHeight)
  ) {
    return 'edge';
  }
  return 'ok';
}
