import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../../lesson-data/validate';
import { auditLesson } from '../../lesson-data/outline-crossings';
import { presentLesson } from '../../i18n/present';
import { NUSANTARA_LESSONS } from './lessons';

describe('Nusantara lessons', () => {
  it('follows the lesson rules and has no crossings or uncovered helpers', () => {
    expect(() => assertValidLessons(NUSANTARA_LESSONS)).not.toThrow();
    expect(NUSANTARA_LESSONS).toHaveLength(8);
    for (const lesson of NUSANTARA_LESSONS) {
      const lines = lesson.steps.filter((step) => step.phase !== 'color');
      expect(lines.length, lesson.id).toBeGreaterThanOrEqual(5);
      expect(lines.length, lesson.id).toBeLessThanOrEqual(11);
      expect(lines[0]?.guidePaths).toHaveLength(1);
      expect(lines[0]?.guidePaths[0]?.d).toMatch(/A|Z/i);
      const firstColour = lesson.steps.findIndex((step) => step.phase === 'color');
      expect(lesson.steps.slice(firstColour).every((step) => step.phase === 'color')).toBe(true);
      const coloured = lesson.steps.filter((step) => step.phase === 'color').flatMap((step) => step.colorRegionIds);
      expect(new Set(coloured).size).toBe(coloured.length);
      expect(new Set(coloured)).toEqual(new Set(lesson.colorRegions.map((region) => region.id)));
      const issues = auditLesson(lesson);
      expect(issues, lesson.id).toEqual([]);
      const english = presentLesson(lesson, 'en');
      expect(english.subtitle).not.toBe(lesson.subtitle);
      expect(english.steps.every((step, index) => step.instruction !== lesson.steps[index]?.instruction)).toBe(true);
    }
  });
});
