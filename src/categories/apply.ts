/**
 * Recolour a done lesson from the photo, and mirror it when the photo faces
 * the other way. Outline ink stays the authored dark colour.
 */

import type { LessonPackage } from '../lesson-data/schema';
import { mirrorPath } from './mirror';
import type { CategoryLesson, Facing } from './types';

export interface PartColour {
  readonly part: string;
  readonly color: string;
}

export function applyPhotoToLesson(
  entry: CategoryLesson,
  choice: { readonly facing: Facing; readonly colours: readonly PartColour[] },
): LessonPackage {
  const colours = new Map(choice.colours.map((item) => [item.part, item.color]));
  const mirror = shouldMirror(entry, choice.facing);
  const width = entry.lesson.coordinateSpace.width;
  const mapPath = (d: string) => (mirror ? mirrorPath(d, width) : d);
  const partByRegion = new Map<string, string>();
  for (const part of entry.parts) {
    for (const id of part.regionIds) partByRegion.set(id, part.id);
  }

  return {
    ...entry.lesson,
    colorRegions: entry.lesson.colorRegions.map((region) => {
      const color = colourFor(partByRegion.get(region.id), colours);
      return {
        ...region,
        d: mapPath(region.d),
        ...(color ? { suggestedColor: color } : {}),
      };
    }),
    steps: entry.lesson.steps.map((step) => {
      const color = step.phase === 'color' ? stepColour(step.colorRegionIds, partByRegion, colours) : undefined;
      return {
        ...step,
        guidePaths: step.guidePaths.map((path) => ({ ...path, d: mapPath(path.d) })),
        toolPreset: color ? { ...step.toolPreset, color } : step.toolPreset,
      };
    }),
    targetPreview: {
      paths: entry.lesson.targetPreview.paths.map((path) => ({ ...path, d: mapPath(path.d) })),
    },
  };
}

export function shouldMirror(entry: CategoryLesson, facing: Facing): boolean {
  if (entry.facing === 'front') return false;
  if (facing !== 'left' && facing !== 'right') return false;
  return facing !== entry.facing;
}

function colourFor(part: string | undefined, colours: ReadonlyMap<string, string>): string | undefined {
  if (!part) return undefined;
  return colours.get(part);
}

function stepColour(
  regionIds: readonly string[],
  partByRegion: ReadonlyMap<string, string>,
  colours: ReadonlyMap<string, string>,
): string | undefined {
  const parts = [...new Set(regionIds.map((id) => partByRegion.get(id)).filter((id): id is string => id !== undefined))];
  if (parts.length !== 1) return undefined;
  return colours.get(parts[0]!);
}
