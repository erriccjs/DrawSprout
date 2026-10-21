/**
 * A category is a hand-authored lesson plus the parts a photo may recolour.
 * Planned entries have a name and no geometry yet.
 */

import type { LessonPackage } from '../lesson-data/schema';

export type Facing = 'left' | 'right' | 'front' | 'unknown';

export interface CategoryPart {
  readonly id: string;
  readonly label: string;
  readonly regionIds: readonly string[];
}

export interface CategoryLesson {
  readonly id: string;
  readonly status: 'done';
  readonly title: string;
  /** One line for the vision prompt. Not shown to the child. */
  readonly hint: string;
  /** Direction the drawing faces. `front` is never mirrored. */
  readonly facing: 'left' | 'right' | 'front';
  readonly parts: readonly CategoryPart[];
  readonly lesson: LessonPackage;
}

export interface PlannedCategory {
  readonly id: string;
  readonly status: 'planned';
  readonly title: string;
  readonly hint: string;
}

export type CategoryEntry = CategoryLesson | PlannedCategory;

export function isDone(entry: CategoryEntry): entry is CategoryLesson {
  return entry.status === 'done';
}
