/**
 * A canvas that records draw calls instead of rasterising.
 *
 * jsdom has no 2D context, and a real one would only let a test assert pixels.
 * Recording the calls lets a test assert the stronger thing: which geometry the
 * renderer was asked to draw at all — which is how `export.test.ts` proves no
 * guide path reaches the exported image.
 */

export interface RecordedCall {
  readonly op: string;
  readonly args: readonly unknown[];
}

export interface RecordingCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly calls: RecordedCall[];
  /** Path data handed to every `Path2D` constructed while recording. */
  readonly clipPathData: string[];
}

/** `d` strings seen by the `Path2D` stub installed in `setup.ts`. */
export const constructedPathData: string[] = [];

export function resetConstructedPathData(): void {
  constructedPathData.length = 0;
}

const recordingsByElement = new WeakMap<HTMLCanvasElement, RecordingCanvas>();

/** Associates a real canvas element with the recording standing in for it. */
export function registerRecording(element: HTMLCanvasElement, recording: RecordingCanvas): void {
  recordingsByElement.set(element, recording);
}

/** Draw calls made through a mounted canvas element, in order. */
export function recordedCalls(element: HTMLCanvasElement): readonly RecordedCall[] {
  return recordingsByElement.get(element)?.calls ?? [];
}

export function createRecordingCanvas(widthPx: number, heightPx: number): RecordingCanvas {
  const calls: RecordedCall[] = [];
  const record =
    (op: string) =>
    (...args: unknown[]): void => {
      calls.push({ op, args });
    };

  const ctx = {
    canvas: null as unknown as HTMLCanvasElement,
    strokeStyle: '#000000',
    fillStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',

    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    arc: record('arc'),
    stroke: record('stroke'),
    fill: record('fill'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    setTransform: record('setTransform'),
    save: record('save'),
    restore: record('restore'),
    clip: record('clip'),
    drawImage: record('drawImage'),
    setLineDash: record('setLineDash'),
  };

  // Recorded as a call, not a plain field, so a test can tell *when* the
  // compositing mode changed relative to the draws around it.
  let compositeOperation = 'source-over';
  Object.defineProperty(ctx, 'globalCompositeOperation', {
    get: () => compositeOperation,
    set: (value: string) => {
      compositeOperation = value;
      calls.push({ op: 'set:globalCompositeOperation', args: [value] });
    },
    enumerable: true,
  });

  const canvas = {
    width: widthPx,
    height: heightPx,
    className: '',
    getContext: (contextId: string) => (contextId === '2d' ? ctx : null),
    setAttribute: () => undefined,
    toBlob: (callback: (blob: Blob | null) => void) => {
      callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }));
    },
  } as unknown as HTMLCanvasElement;

  ctx.canvas = canvas;

  return { canvas, calls, clipPathData: constructedPathData };
}

/** All coordinate pairs passed to the path-building calls, in order. */
export function pathPoints(calls: readonly RecordedCall[]): [number, number][] {
  const points: [number, number][] = [];
  for (const call of calls) {
    if (call.op === 'moveTo' || call.op === 'lineTo') {
      points.push([call.args[0] as number, call.args[1] as number]);
    } else if (call.op === 'quadraticCurveTo') {
      points.push([call.args[0] as number, call.args[1] as number]);
      points.push([call.args[2] as number, call.args[3] as number]);
    } else if (call.op === 'arc') {
      points.push([call.args[0] as number, call.args[1] as number]);
    }
  }
  return points;
}
