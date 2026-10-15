/**
 * Lesson package validation.
 *
 * PRD section 13 ("Konten vektor") allows only a subset of path geometry and
 * forbids script, external URLs, or active markup coming out of lesson content,
 * and PRD section 14 says an invalid lesson path must stop the package from
 * opening rather than be rendered anyway. The checks live next to the data so
 * the engine and the renderer can both assume a package is already sane.
 */

import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';

/** Commands of the SVG path grammar the renderer is allowed to execute. */
const ALLOWED_PATH_COMMANDS = 'MmLlHhVvCcSsQqTtAaZz';

/** Anything outside this set means the `d` string is not plain geometry. */
const ALLOWED_PATH_CHARS = new RegExp(`^[${ALLOWED_PATH_COMMANDS}0-9eE+\\-.,\\s]*$`);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class LessonValidationError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Lesson package is not valid:\n- ${problems.join('\n- ')}`);
    this.name = 'LessonValidationError';
    this.problems = problems;
  }
}

/** Returns every problem found, so an author sees the whole list at once. */
export function findLessonProblems(lesson: LessonPackage): string[] {
  const problems: string[] = [];

  if (lesson.schemaVersion !== LESSON_SCHEMA_VERSION) {
    problems.push(
      `schemaVersion ${lesson.schemaVersion} is not the supported version ${LESSON_SCHEMA_VERSION}`,
    );
  }
  if (lesson.coordinateSpace.width <= 0 || lesson.coordinateSpace.height <= 0) {
    problems.push('coordinateSpace must have a positive width and height');
  }
  if (lesson.steps.length === 0) {
    problems.push('lesson has no steps');
  }
  if (lesson.title.trim() === '') {
    problems.push('lesson has an empty title');
  }
  if (lesson.subtitle.trim() === '') {
    problems.push('lesson has an empty subtitle');
  }
  if (lesson.targetPreview.paths.length === 0) {
    problems.push('targetPreview has no paths to draw');
  }

  const regionIds = new Set<string>();
  for (const region of lesson.colorRegions) {
    if (regionIds.has(region.id)) problems.push(`duplicate color region id "${region.id}"`);
    regionIds.add(region.id);
    problems.push(...pathProblems(`color region "${region.id}"`, region.d));
    if (!HEX_COLOR.test(region.suggestedColor)) {
      problems.push(`color region "${region.id}" suggestedColor must be a #rrggbb hex colour`);
    }
  }

  const stepIds = new Set<string>();
  for (const step of lesson.steps) {
    if (stepIds.has(step.id)) problems.push(`duplicate step id "${step.id}"`);
    stepIds.add(step.id);

    if (step.instruction.trim() === '') problems.push(`step "${step.id}" has an empty instruction`);

    for (const guide of step.guidePaths) {
      problems.push(...pathProblems(`step "${step.id}" guide "${guide.id}"`, guide.d));
    }
    for (const regionId of step.colorRegionIds) {
      if (!regionIds.has(regionId)) {
        problems.push(`step "${step.id}" references unknown color region "${regionId}"`);
      }
    }
    if (!HEX_COLOR.test(step.toolPreset.color)) {
      problems.push(`step "${step.id}" toolPreset.color must be a #rrggbb hex colour`);
    }
    if (step.toolPreset.widthViewbox <= 0) {
      problems.push(`step "${step.id}" toolPreset.widthViewbox must be positive`);
    }
    if (!step.completionPolicy.manualAllowed && !step.completionPolicy.automaticEnabled) {
      problems.push(`step "${step.id}" can never be completed: no manual and no automatic path`);
    }
    if (step.phase === 'color' && step.colorRegionIds.length === 0) {
      problems.push(`colour step "${step.id}" has no color regions to fill`);
    }
  }

  const previewPathIds = new Set<string>();
  for (const path of lesson.targetPreview.paths) {
    if (previewPathIds.has(path.id)) problems.push(`duplicate target preview path id "${path.id}"`);
    previewPathIds.add(path.id);
    problems.push(...pathProblems(`target preview path "${path.id}"`, path.d));
  }

  return problems;
}

function pathProblems(where: string, d: string): string[] {
  const problems: string[] = [];
  if (d.trim() === '') {
    problems.push(`${where} has an empty path`);
    return problems;
  }
  if (!ALLOWED_PATH_CHARS.test(d)) {
    problems.push(`${where} contains characters outside the allowed path subset`);
  }
  if (!/^[Mm]/.test(d.trim())) {
    problems.push(`${where} must start with a moveto command`);
  }
  return problems;
}

/**
 * Throws unless every package in the list is safe to show and to open. Call
 * this before any lesson reaches the picker, the engine or the renderer: the
 * picker draws a tile from a package before anyone taps it, and a lesson id
 * shared by two packages would open the wrong one.
 */
export function assertValidLessons(lessons: readonly LessonPackage[]): void {
  const problems: string[] = [];
  const lessonIds = new Set<string>();

  for (const lesson of lessons) {
    if (lessonIds.has(lesson.id)) problems.push(`duplicate lesson id "${lesson.id}"`);
    lessonIds.add(lesson.id);
    problems.push(...findLessonProblems(lesson));
  }

  if (problems.length > 0) throw new LessonValidationError(problems);
}
