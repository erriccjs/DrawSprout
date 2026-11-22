import { describe, expect, it } from 'vitest';
import { CATEGORY_LESSONS } from '../categories/library';
import { BUNDLED_LESSONS } from './index';
import { auditLesson, cleanLessonOutlines, crossingsBetween } from './outline-crossings';

const authored = [
  ...CATEGORY_LESSONS.map((entry) => entry.lesson),
  ...BUNDLED_LESSONS,
];

describe('final outlines meet instead of passing through', () => {
  it('flags a line that crosses another and ignores a line that ends on it', () => {
    const cross = crossingsBetween(
      [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    );
    expect(cross).toHaveLength(1);
    const junction = crossingsBetween(
      [{ x: 0, y: 50 }, { x: 50, y: 50 }],
      [{ x: 50, y: 0 }, { x: 50, y: 100 }],
    );
    expect(junction).toHaveLength(0);
  });

  it('clears every hand-authored lesson after the strokes are cut at the contour', () => {
    const before = authored.reduce((sum, lesson) => (
      sum + auditLesson(lesson).filter((issue) => issue.kind === 'crossing').length
    ), 0);
    const cleaned = authored.map(cleanLessonOutlines);
    const after = cleaned.reduce((sum, lesson) => sum + auditLesson(lesson).length, 0);
    expect(before).toBeGreaterThan(after);
    expect(after).toBe(0);
  });
});
