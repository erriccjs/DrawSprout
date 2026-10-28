/**
 * The house style for a hand-authored lesson.
 * One basic shape first, then one part on each drawing step, then flat colour.
 * The example paints the new part red and earlier lines dark; these checks
 * keep a draft in the shape that preview already understands.
 */

import type { LessonPackage } from '../lesson-data/schema';
import { findLessonProblems } from '../lesson-data/validate';

export function styleProblems(lesson: LessonPackage): string[] {
  const problems = [...findLessonProblems(lesson)];
  const drawing = lesson.steps.filter((step) => step.phase !== 'color');

  if (drawing.length < 3) problems.push('A lesson needs at least three drawing steps.');
  if (drawing.length > 14) problems.push('More than 14 drawing steps is too long for one sitting.');

  const first = drawing[0];
  if (first) {
    if (first.guidePaths.length !== 1) {
      problems.push('The first step must be one basic shape.');
    }
    const shape = first.guidePaths[0];
    if (shape && shape.role !== 'final-outline') {
      problems.push('The first shape is part of the finished drawing, not a helper.');
    }
    if (shape && !/[AZ]/i.test(shape.d)) {
      problems.push('The first shape must be closed (a circle, oval, or shape that ends with Z).');
    }
  }

  const colourAt = lesson.steps.findIndex((step) => step.phase === 'color');
  if (colourAt < 0) {
    problems.push('The last steps must be flat colour.');
  } else if (lesson.steps.slice(colourAt).some((step) => step.phase !== 'color')) {
    problems.push('Flat colour comes after every drawing step.');
  }

  const seenFinal = new Set<string>();
  for (const step of drawing) {
    const freshFinal = step.guidePaths.filter((guide) => guide.role === 'final-outline' && !seenFinal.has(guide.id));
    const freshHelper = step.guidePaths.filter((guide) => guide.role === 'construction' && !seenBefore(drawing, step.id, guide.id));
    if (freshFinal.length === 0 && freshHelper.length === 0 && step !== first) {
      problems.push(`Step "${step.id}" does not add a part.`);
    }
    if (freshFinal.length > 0 && freshHelper.length > 0) {
      problems.push(`Step "${step.id}" adds a finished line and a new helper. Split them into two steps.`);
    }
    for (const guide of step.guidePaths) {
      if (guide.role === 'final-outline') seenFinal.add(guide.id);
    }
  }

  if (lesson.targetPreview.paths.some((path) => path.role !== 'final-outline')) {
    problems.push('Helpers must not remain in the finished picture.');
  }

  return problems;
}

function seenBefore(steps: LessonPackage['steps'], stepId: string, guideId: string): boolean {
  for (const step of steps) {
    if (step.id === stepId) return false;
    if (step.guidePaths.some((guide) => guide.id === guideId)) return true;
  }
  return false;
}
