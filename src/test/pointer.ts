/**
 * Synthetic pointer input for component tests.
 *
 * These are browser-emulated events, not device input. They exercise the
 * app's own pointer handling; they say nothing about Apple Pencil behaviour,
 * palm rejection or latency on real hardware (AT-16, AT-17, AT-18).
 */

export interface StrokeSample {
  readonly x: number;
  readonly y: number;
}

export interface PointerOptions {
  readonly pointerId?: number;
  readonly pointerType?: 'pen' | 'touch' | 'mouse';
  readonly width?: number;
  readonly height?: number;
}

/** A box the canvas pretends to occupy, so client coordinates map cleanly. */
export const TEST_CANVAS_RECT = { left: 0, top: 0, width: 1000, height: 750 } as const;

export function stubLayoutBox(width: number = TEST_CANVAS_RECT.width, height: number = TEST_CANVAS_RECT.height): void {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    };
  };
}

function pointerEvent(type: string, sample: StrokeSample, options: PointerOptions): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: options.pointerId ?? 1,
    pointerType: options.pointerType ?? 'mouse',
    isPrimary: true,
    clientX: sample.x,
    clientY: sample.y,
    width: options.width ?? 1,
    height: options.height ?? 1,
  });
}

export function pointerDown(target: Element, sample: StrokeSample, options: PointerOptions = {}): void {
  target.dispatchEvent(pointerEvent('pointerdown', sample, options));
}

export function pointerMove(target: Element, sample: StrokeSample, options: PointerOptions = {}): void {
  target.dispatchEvent(pointerEvent('pointermove', sample, options));
}

export function pointerUp(target: Element, sample: StrokeSample, options: PointerOptions = {}): void {
  target.dispatchEvent(pointerEvent('pointerup', sample, options));
}

export function pointerCancel(target: Element, sample: StrokeSample, options: PointerOptions = {}): void {
  target.dispatchEvent(pointerEvent('pointercancel', sample, options));
}

/** Draws a whole stroke: down, a few moves, then up. */
export function drawStroke(
  target: Element,
  samples: readonly StrokeSample[],
  options: PointerOptions = {},
): void {
  const [first, ...rest] = samples;
  if (!first) return;
  pointerDown(target, first, options);
  for (const sample of rest) pointerMove(target, sample, options);
  pointerUp(target, rest.at(-1) ?? first, options);
}
