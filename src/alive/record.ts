/**
 * Optional short recording of the living picture.
 *
 * iOS Safari has no `canvas.captureStream`, so the caller keeps the PNG share.
 * A share started after the recording finishes is often outside the original
 * tap, and then the file is downloaded instead. Nothing is uploaded.
 */

export function recordingSupported(canvas: HTMLCanvasElement): boolean {
  const withStream = canvas as HTMLCanvasElement & { captureStream?: (frameRate?: number) => MediaStream };
  return typeof withStream.captureStream === 'function' && typeof MediaRecorder !== 'undefined';
}

export interface CanvasRecording {
  readonly stop: () => Promise<Blob>;
}

export function beginRecording(canvas: HTMLCanvasElement): CanvasRecording | null {
  const withStream = canvas as HTMLCanvasElement & { captureStream?: (frameRate?: number) => MediaStream };
  if (!recordingSupported(canvas) || !withStream.captureStream) return null;
  let stream: MediaStream;
  try {
    stream = withStream.captureStream(12);
  } catch {
    return null;
  }
  const mime = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((item) => {
    try {
      return MediaRecorder.isTypeSupported(item);
    } catch {
      return false;
    }
  }) ?? '';
  let recorder: MediaRecorder;
  try {
    recorder = mime === '' ? new MediaRecorder(stream) : new MediaRecorder(stream, { mimeType: mime });
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    return null;
  }
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  const stopped = new Promise<Blob>((resolve) => {
    recorder.addEventListener('stop', () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    });
    recorder.addEventListener('error', () => {
      resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
    });
  });
  try {
    recorder.start(250);
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    return null;
  }
  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      return stopped;
    },
  };
}
