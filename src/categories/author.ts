/**
 * Small builders for a hand-authored category lesson.
 *
 * The package is still schema version 1. The step id is the step's name.
 */

import {
  LESSON_SCHEMA_VERSION,
  type ColorRegion,
  type GuidePath,
  type GuideRole,
  type LessonPackage,
  type LessonStep,
} from '../lesson-data/schema';

export const INK = '#3a3a3a';

const MANUAL = { manualAllowed: true, automaticEnabled: false } as const;

export function guide(id: string, d: string, role: GuideRole = 'final-outline'): GuidePath {
  return { id, d, role };
}

export function region(id: string, label: string, d: string, suggestedColor: string): ColorRegion {
  return { id, label, d, suggestedColor };
}

export function outline(
  id: string,
  instruction: string,
  guides: readonly GuidePath[],
  hint?: string,
  width = 8,
): LessonStep {
  return line('outline', id, instruction, guides, width, hint);
}

export function detail(
  id: string,
  instruction: string,
  guides: readonly GuidePath[],
  hint?: string,
  width = 5,
): LessonStep {
  return line('detail', id, instruction, guides, width, hint);
}

export function colorStep(
  id: string,
  instruction: string,
  colorRegionIds: readonly string[],
  color: string,
  hint?: string,
  width = 44,
): LessonStep {
  return {
    id,
    phase: 'color',
    instruction,
    ...(hint ? { hint } : {}),
    guidePaths: [],
    colorRegionIds,
    toolPreset: { tool: 'brush', color, widthViewbox: width },
    completionPolicy: MANUAL,
  };
}

export function packageLesson(input: {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly steps: readonly LessonStep[];
  readonly colorRegions: readonly ColorRegion[];
}): LessonPackage {
  return {
    id: input.id,
    schemaVersion: LESSON_SCHEMA_VERSION,
    contentVersion: '1.0.0',
    title: input.title,
    subtitle: input.subtitle,
    coordinateSpace: { width: 1000, height: 750 },
    steps: input.steps,
    colorRegions: input.colorRegions,
    targetPreview: {
      paths: input.steps.flatMap((step) => step.guidePaths.filter((path) => path.role === 'final-outline')),
    },
  };
}

function line(
  phase: 'outline' | 'detail',
  id: string,
  instruction: string,
  guides: readonly GuidePath[],
  width: number,
  hint?: string,
): LessonStep {
  return {
    id,
    phase,
    instruction,
    ...(hint ? { hint } : {}),
    guidePaths: guides,
    colorRegionIds: [],
    toolPreset: { tool: 'pen', color: INK, widthViewbox: width },
    completionPolicy: MANUAL,
  };
}
