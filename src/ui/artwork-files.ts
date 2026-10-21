/**
 * Gallery thumbnail and PNG download.
 *
 * Both go through `renderArtworkToCanvas` / `exportArtworkPng`, which accept
 * strokes and clip paths only. Guide paths and the target illustration are not
 * parameters, so a thumbnail cannot include them (FR-14).
 */

import type { LessonPackage } from '../lesson-data/schema';
import type { Stroke } from '../lesson-engine/types';
import { artworkFileName, exportArtworkPng, renderArtworkToCanvas } from '../renderer/export';
import { clipPathsFromLesson, toRenderStrokes } from './render-adapter';

/** Wide enough to stay sharp in a card, small enough to paint a list of them. */
export const THUMBNAIL_WIDTH_PX = 400;

export function paintArtworkThumbnail(
  host: HTMLElement,
  lesson: LessonPackage,
  strokes: readonly Stroke[],
): void {
  const canvas = renderArtworkToCanvas({
    space: lesson.coordinateSpace,
    strokes: toRenderStrokes(strokes),
    clipPaths: clipPathsFromLesson(lesson),
    pixelWidth: THUMBNAIL_WIDTH_PX,
  });
  canvas.className = 'artwork-card__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Karya ${lesson.title}`);
  host.replaceChildren(canvas);
}

/** Downloads the child's strokes as a PNG. Returns the file name shown in the status. */
export async function downloadArtwork(lesson: LessonPackage, strokes: readonly Stroke[]): Promise<string> {
  const blob = await exportArtworkPng({
    space: lesson.coordinateSpace,
    strokes: toRenderStrokes(strokes),
    clipPaths: clipPathsFromLesson(lesson),
  });
  const fileName = artworkFileName(lesson.title);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  requestAnimationFrame(() => URL.revokeObjectURL(url));
  return fileName;
}

/** Indonesian date and time for a saved artwork. */
export function formatArtworkWhen(updatedAt: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(updatedAt));
}
