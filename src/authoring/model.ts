/**
 * A draft lesson is the shape the authoring tool edits and the model returns.
 * `compileDraft` turns it into the same package the app already draws.
 */

import { packageLesson } from '../categories/author';
import type { GuidePath, LessonPackage, LessonPhase } from '../lesson-data/schema';

export interface DraftGuide {
  readonly id: string;
  readonly d: string;
  readonly role: GuidePath['role'];
}

export interface DraftStep {
  readonly id: string;
  readonly phase: LessonPhase;
  readonly instruction: string;
  readonly hint: string;
  readonly guides: readonly DraftGuide[];
  readonly colorRegionIds: readonly string[];
  readonly color: string;
  readonly instructionEn: string;
  readonly hintEn: string;
}

export interface DraftRegion {
  readonly id: string;
  readonly label: string;
  readonly d: string;
  readonly suggestedColor: string;
}

export interface DraftLesson {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly steps: readonly DraftStep[];
  readonly regions: readonly DraftRegion[];
}

const INK = '#3a3a3a';

export function compileDraft(draft: DraftLesson): LessonPackage {
  return packageLesson({
    id: draft.id,
    title: draft.title,
    subtitle: draft.subtitle,
    colorRegions: draft.regions.map((region) => ({
      id: region.id,
      label: region.label,
      d: region.d,
      suggestedColor: region.suggestedColor,
    })),
    steps: draft.steps.map((step) => ({
      id: step.id,
      phase: step.phase,
      instruction: step.instruction,
      ...(step.hint ? { hint: step.hint } : {}),
      guidePaths: step.guides.map((guide) => ({ id: guide.id, d: guide.d, role: guide.role })),
      colorRegionIds: step.phase === 'color' ? step.colorRegionIds : [],
      toolPreset: {
        tool: step.phase === 'color' ? 'brush' as const : 'pen' as const,
        color: step.phase === 'color' ? step.color : INK,
        widthViewbox: step.phase === 'color' ? 44 : step.phase === 'detail' ? 5 : 8,
      },
      completionPolicy: { manualAllowed: true, automaticEnabled: false },
    })),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

/** Accepts the model's JSON, including a missing English line. */
export function parseDraft(value: unknown): DraftLesson {
  if (!isRecord(value)) throw new Error('Draft was not an object');
  const steps = Array.isArray(value.steps) ? value.steps : [];
  const regions = Array.isArray(value.regions) ? value.regions : [];
  return {
    id: text(value.id),
    title: text(value.title),
    subtitle: text(value.subtitle),
    steps: steps.map((step) => {
      const record = isRecord(step) ? step : {};
      const phase = record.phase === 'detail' || record.phase === 'color' ? record.phase : 'outline';
      const guides = Array.isArray(record.guides) ? record.guides : [];
      return {
        id: text(record.id),
        phase,
        instruction: text(record.instruction),
        hint: text(record.hint),
        instructionEn: text(record.instructionEn),
        hintEn: text(record.hintEn),
        color: text(record.color, '#3a3a3a'),
        colorRegionIds: Array.isArray(record.colorRegionIds)
          ? record.colorRegionIds.filter((id): id is string => typeof id === 'string')
          : [],
        guides: guides.map((guide) => {
          const item = isRecord(guide) ? guide : {};
          return {
            id: text(item.id),
            d: text(item.d),
            role: item.role === 'construction' ? 'construction' as const : 'final-outline' as const,
          };
        }),
      };
    }),
    regions: regions.map((region) => {
      const record = isRecord(region) ? region : {};
      return {
        id: text(record.id),
        label: text(record.label),
        d: text(record.d),
        suggestedColor: text(record.suggestedColor, '#888888'),
      };
    }),
  };
}

/** A module the library can paste in after a person has checked the drawing. */
export function lessonModuleSource(draft: DraftLesson): string {
  const steps = draft.steps.map((step) => {
    if (step.phase === 'color') {
      return `      colorStep(${quote(step.id)}, ${quote(step.instruction)}, ${JSON.stringify(step.colorRegionIds)}, ${quote(step.color)}, ${quote(step.hint)}),`;
    }
    const guides = step.guides.map((guide) => (
      `        guide(${quote(guide.id)}, ${quote(guide.d)}${guide.role === 'construction' ? ", 'construction'" : ''}),`
    )).join('\n');
    const maker = step.phase === 'detail' ? 'detail' : 'outline';
    return `      ${maker}(${quote(step.id)}, ${quote(step.instruction)}, [\n${guides}\n      ], ${quote(step.hint)}),`;
  }).join('\n');
  const regions = draft.regions.map((region) => (
    `      region(${quote(region.id)}, ${quote(region.label)}, ${quote(region.d)}, ${quote(region.suggestedColor)}),`
  )).join('\n');
  return `import { colorStep, detail, guide, outline, packageLesson, region } from '../author';

export const lesson = packageLesson({
  id: ${quote(draft.id)},
  title: ${quote(draft.title)},
  subtitle: ${quote(draft.subtitle)},
  colorRegions: [
${regions}
  ],
  steps: [
${steps}
  ],
});
`;
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
