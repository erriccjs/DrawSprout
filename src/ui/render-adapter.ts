/**
 * Adapter between the lesson/engine model and the renderer.
 *
 * It exists so neither side has to know the other: the engine keeps lesson
 * semantics (steps, tools, colour regions) and the renderer keeps geometry and
 * paint. Everything that translates one into the other lives here.
 */

import type { LessonPackage } from '../lesson-data/schema';
import { FREE_STEP_ID } from '../lesson-engine/session';
import type { Stroke } from '../lesson-engine/types';
import type { RenderStroke } from '../renderer/types';

export function toRenderStroke(stroke: Stroke): RenderStroke {
  const erase = stroke.tool === 'eraser';
  return {
    points: stroke.points,
    color: stroke.color,
    width: stroke.width,
    layer: stroke.layerId,
    erase,
    eraseAll: erase && stroke.stepId === FREE_STEP_ID,
    clipPathIds: stroke.clipRegionIds,
  };
}

export function toRenderStrokes(strokes: readonly Stroke[]): RenderStroke[] {
  return strokes.map(toRenderStroke);
}

/**
 * The clip-path registry the renderer needs: colour region ids mapped to path
 * data. The renderer treats the ids as opaque.
 */
export function clipPathsFromLesson(lesson: LessonPackage): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const region of lesson.colorRegions) paths[region.id] = region.d;
  return paths;
}
