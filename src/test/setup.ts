/**
 * Test environment shims.
 *
 * jsdom has no IndexedDB, no `Path2D`, no `ResizeObserver` and no 2D canvas
 * context. Each shim below stands in for exactly one of those, and nothing here
 * changes application behaviour.
 */

import 'fake-indexeddb/auto';
import { constructedPathData, createRecordingCanvas, registerRecording } from './fake-canvas';

/** Records the path data so tests can assert what geometry was clipped with. */
class FakePath2D {
  readonly d: string;

  constructor(d = '') {
    this.d = d;
    constructedPathData.push(d);
  }
}

Object.defineProperty(globalThis, 'Path2D', {
  value: FakePath2D,
  writable: true,
  configurable: true,
});

class FakeResizeObserver {
  observe(): void {
    /* layout never changes under jsdom */
  }
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: FakeResizeObserver,
  writable: true,
  configurable: true,
});

// Give every canvas element a recording context, so components that draw can
// mount without a real rasteriser.
HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
  const existing = recordingContexts.get(this);
  if (existing) return existing;
  const recording = createRecordingCanvas(this.width, this.height);
  registerRecording(this, recording);
  const ctx = recording.canvas.getContext('2d');
  recordingContexts.set(this, ctx);
  return ctx;
} as HTMLCanvasElement['getContext'];

const recordingContexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D | null>();

HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback) {
  callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }));
};

// jsdom implements `PointerEvent` but not pointer capture. The renderer relies
// on capture to keep receiving a stroke that leaves the canvas, so the stub
// tracks which pointer is captured rather than being a no-op.
const capturedPointers = new WeakMap<Element, Set<number>>();

Element.prototype.setPointerCapture = function setPointerCapture(pointerId: number) {
  const captured = capturedPointers.get(this) ?? new Set<number>();
  captured.add(pointerId);
  capturedPointers.set(this, captured);
};

Element.prototype.releasePointerCapture = function releasePointerCapture(pointerId: number) {
  capturedPointers.get(this)?.delete(pointerId);
};

Element.prototype.hasPointerCapture = function hasPointerCapture(pointerId: number) {
  return capturedPointers.get(this)?.has(pointerId) ?? false;
};
