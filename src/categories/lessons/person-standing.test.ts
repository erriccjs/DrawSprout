import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../../lesson-data';
import { stepPreview } from '../../lesson-data/step-preview';
import { PERSON_STANDING_CATEGORY } from './person-standing';

/**
 * Highest y in a path. Commands are the lesson subset (M L Q C A Z).
 * Used only to check that the figure is tall beside its head.
 */
function maxY(d: string): number {
  const tokens = d.match(/[MmLlHhVvCcQqAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  let max = 0;
  let i = 0;
  const take = (count: number) => {
    const values: number[] = [];
    for (let n = 0; n < count; n += 1) {
      i += 1;
      values.push(Number(tokens[i]));
    }
    return values;
  };
  while (i < tokens.length) {
    const command = tokens[i];
    if (!command || !/[A-Za-z]/.test(command)) break;
    if (command === 'Z' || command === 'z') {
      i += 1;
      continue;
    }
    if (command === 'H' || command === 'h' || command === 'V' || command === 'v') {
      const [value] = take(1);
      if ((command === 'V' || command === 'v') && value !== undefined) max = Math.max(max, value);
      continue;
    }
    const count = command === 'A' || command === 'a' ? 7 : command === 'C' || command === 'c' ? 6 : command === 'Q' || command === 'q' ? 4 : 2;
    const values = take(count);
    const y = values[values.length - 1];
    if (y !== undefined) max = Math.max(max, y);
  }
  return max;
}

describe('standing person proportions', () => {
  const lesson = PERSON_STANDING_CATEGORY.lesson;

  it('is a valid tall figure: one circle first, then one part, then flat colour', () => {
    expect(() => assertValidLessons([lesson])).not.toThrow();
    expect(lesson.contentVersion).toBe('1.1.0');
    const lines = lesson.steps.filter((step) => step.phase !== 'color');
    expect(lines.map((step) => step.id)).toEqual([
      'head', 'neck', 'torso', 'hips', 'legs', 'arms', 'contour', 'trousers', 'shoes', 'face', 'hair',
    ]);
    expect(lines[0]?.guidePaths).toHaveLength(1);
    expect(lines[0]?.guidePaths[0]?.role).toBe('final-outline');

    const head = lines[0]?.guidePaths[0]?.d ?? '';
    const radius = Number(head.match(/A (\d+)/)?.[1]);
    const crown = Number(head.match(/M \d+ (\d+)/)?.[1]) - radius;
    const sole = Math.max(...lesson.targetPreview.paths.map((path) => maxY(path.d)));
    const headsTall = (sole - crown) / (radius * 2);
    expect(headsTall).toBeGreaterThan(7);
    expect(headsTall).toBeLessThan(8.2);

    for (const id of ['torso', 'hips', 'legs', 'arms']) {
      const step = lines.find((item) => item.id === id);
      expect(step?.guidePaths.every((path) => path.role === 'construction')).toBe(true);
    }
    expect(lesson.steps.slice(lines.length).every((step) => step.phase === 'color')).toBe(true);
  });

  it('shows the new part in red, earlier lines in dark, and drops helpers before colour', () => {
    const contour = lesson.steps.findIndex((step) => step.id === 'contour');
    const preview = stepPreview(lesson, contour);
    const shirt = preview.strokes.find((stroke) => stroke.id === 'shirt');
    const neck = preview.strokes.find((stroke) => stroke.id === 'neck-left');
    const helper = preview.strokes.find((stroke) => stroke.id === 'torso');
    expect(shirt?.kind).toBe('new');
    expect(neck?.kind).toBe('earlier');
    expect(helper?.kind).toBe('construction');

    const colour = lesson.steps.findIndex((step) => step.phase === 'color');
    const filled = stepPreview(lesson, colour);
    expect(filled.strokes.some((stroke) => stroke.kind === 'construction')).toBe(false);
    expect(filled.strokes.every((stroke) => stroke.kind === 'earlier')).toBe(true);
    expect(filled.activeOutlines.length).toBeGreaterThan(0);
    expect(filled.fills.some((fill) => fill.fill !== 'paper')).toBe(true);
  });
});
