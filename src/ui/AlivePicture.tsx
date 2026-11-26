/**
 * The finished picture, still or briefly alive.
 *
 * One play lasts a few seconds and then the canvas rests. Reduced motion is
 * the caller's choice: leave `autoPlay` off, and start `replay` from a tap.
 */

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { ALIVE_MS } from '../alive/motion';
import { ALIVE_WIDTH_PX, paintAlive } from '../alive/paint';
import type { AliveStroke } from '../alive/presets';
import { beginRecording } from '../alive/record';
import type { LessonPackage } from '../lesson-data/schema';
import type { Stroke } from '../lesson-engine/types';
import type { ExportUnderlay } from '../renderer/export';

export interface AliveHandle {
  readonly replay: () => void;
  /** A short WebM or MP4 when this browser can record a canvas, otherwise null. */
  readonly record: () => Promise<Blob | null>;
}

interface AlivePictureProps {
  readonly lesson: LessonPackage;
  readonly strokes: readonly Stroke[];
  readonly clipPaths: Record<string, string>;
  readonly underlay?: ExportUnderlay;
  readonly label: string;
  readonly autoPlay: boolean;
  readonly className?: string;
  readonly handle?: Ref<AliveHandle>;
  readonly onPlay: () => void;
}

const FRAME_MS = 50;

export function AlivePicture({
  lesson,
  strokes,
  clipPaths,
  underlay,
  label,
  autoPlay,
  className,
  handle = null,
  onPlay,
}: AlivePictureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const latest = useRef({
    clipPaths,
    underlay,
    onPlay,
    strokes: toAliveStrokes(strokes),
  });
  useEffect(() => {
    latest.current = {
      clipPaths,
      underlay,
      onPlay,
      strokes: toAliveStrokes(strokes),
    };
  });

  const paintAt = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = latest.current;
    paintAlive(
      canvas,
      lesson.id,
      lesson.coordinateSpace,
      current.strokes,
      t,
      current.clipPaths,
      current.underlay,
    );
  }, [lesson.coordinateSpace, lesson.id]);

  const play = useCallback((whenDone?: () => void) => {
    cancelRef.current?.();
    latest.current.onPlay();
    if (typeof requestAnimationFrame !== 'function') {
      paintAt(1);
      whenDone?.();
      return;
    }
    const started = performance.now();
    let last = 0;
    let frame = 0;
    const step = (now: number) => {
      if (now - last < FRAME_MS && now !== started) {
        frame = requestAnimationFrame(step);
        return;
      }
      last = now;
      const t = Math.min(1, (now - started) / ALIVE_MS);
      paintAt(t);
      if (t < 1) frame = requestAnimationFrame(step);
      else whenDone?.();
    };
    paintAt(0);
    frame = requestAnimationFrame(step);
    cancelRef.current = () => cancelAnimationFrame(frame);
  }, [paintAt]);

  useImperativeHandle(handle, () => ({
    replay: () => play(),
    record: () => {
      const canvas = canvasRef.current;
      const session = canvas ? beginRecording(canvas) : null;
      if (!session) return Promise.resolve(null);
      return new Promise((resolve) => {
        play(() => {
          void session.stop().then(resolve, () => resolve(null));
        });
      });
    },
  }), [play]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const height = Math.max(1, Math.round(ALIVE_WIDTH_PX * (lesson.coordinateSpace.height / lesson.coordinateSpace.width)));
    canvas.width = ALIVE_WIDTH_PX;
    canvas.height = height;
    if (!autoPlay) {
      paintAt(1);
      return;
    }
    play();
    return () => cancelRef.current?.();
    // The latest strokes, clips, and callback are read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, lesson.id, strokes]);

  useEffect(() => () => cancelRef.current?.(), []);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={label} />;
}

function toAliveStrokes(strokes: readonly Stroke[]): AliveStroke[] {
  return strokes.map((stroke) => ({
    stepId: stroke.stepId,
    points: stroke.points,
    color: stroke.color,
    width: stroke.width,
    layer: stroke.layerId,
    erase: stroke.tool === 'eraser',
    sequence: stroke.sequence,
    clipRegionIds: stroke.clipRegionIds,
  }));
}
