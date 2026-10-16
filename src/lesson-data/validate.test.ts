import { describe, expect, it } from 'vitest';
import { CAT_LESSON } from './cat-lesson';
import { FLOWER_LESSON } from './flower-lesson';
import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';
import { LessonValidationError, assertValidLessons, findLessonProblems } from './validate';

describe('lesson package validation', () => {
  it('accepts the hand-authored cat lesson', () => {
    expect(findLessonProblems(CAT_LESSON)).toEqual([]);
  });

  it('accepts the flower lesson with outline, detail, then colour steps', () => {
    expect(findLessonProblems(FLOWER_LESSON)).toEqual([]);
    expect(FLOWER_LESSON.steps.map((step) => step.phase)).toEqual([
      'outline', 'outline', 'outline', 'outline', 'detail', 'detail', 'color', 'color', 'color',
    ]);
  });

  it('gives every flower colour step existing closed regions', () => {
    const regions = new Map(FLOWER_LESSON.colorRegions.map((region) => [region.id, region]));
    for (const step of FLOWER_LESSON.steps.filter((item) => item.phase === 'color')) {
      expect(step.colorRegionIds.length).toBeGreaterThan(0);
      for (const id of step.colorRegionIds) {
        expect(regions.get(id)?.d.trim().endsWith('Z')).toBe(true);
      }
    }
  });

  it('keeps flower petal and stem closures out of visible outlines', () => {
    const visible = FLOWER_LESSON.steps.flatMap((step) => step.guidePaths);
    const preview = new Map(FLOWER_LESSON.targetPreview.paths.map((path) => [path.id, path]));
    const regions = new Map(FLOWER_LESSON.colorRegions.map((region) => [region.id, region]));

    const flowerParts = visible.filter((path) => path.id.startsWith('petal-') || path.id === 'stem');
    expect(flowerParts).toHaveLength(6);

    for (const guide of flowerParts) {
      expect(guide.d.trim().endsWith('Z')).toBe(false);
      expect(preview.get(guide.id)?.d).toBe(guide.d);
      expect(regions.get(guide.id)?.d.trim().endsWith('Z')).toBe(true);
      expect(regions.get(guide.id)?.d).not.toBe(guide.d);
    }
  });

  it('authors the cat lesson with 7 shape and detail steps plus colour steps', () => {
    // PRD section 5 Tahap A and section 20 item 2 ask for 6-8 shape/detail
    // steps plus a colour phase.
    const drawing = CAT_LESSON.steps.filter((step) => step.phase !== 'color');
    const colouring = CAT_LESSON.steps.filter((step) => step.phase === 'color');
    expect(drawing.length).toBeGreaterThanOrEqual(6);
    expect(drawing.length).toBeLessThanOrEqual(8);
    expect(colouring.length).toBeGreaterThan(0);
    // Big shapes come before detail (PRD section 9.1).
    expect(drawing.map((step) => step.phase)).toEqual([
      'outline',
      'outline',
      'outline',
      'detail',
      'detail',
      'detail',
      'detail',
    ]);
  });

  it('rejects path data outside the allowed geometry subset', () => {
    const lesson = withFirstStepGuide(CAT_LESSON, 'M 0 0 L url(#x) 10');
    expect(findLessonProblems(lesson)).toContain(
      'step "head-outline" guide "head" contains characters outside the allowed path subset',
    );
  });

  it('rejects a path that does not start with a moveto', () => {
    const lesson = withFirstStepGuide(CAT_LESSON, 'L 10 10');
    expect(findLessonProblems(lesson)).toContain(
      'step "head-outline" guide "head" must start with a moveto command',
    );
  });

  it('rejects a step that points at a colour region the lesson does not define', () => {
    const lesson: LessonPackage = {
      ...CAT_LESSON,
      steps: CAT_LESSON.steps.map((step) =>
        step.id === 'color-face' ? { ...step, colorRegionIds: ['nose', 'ghost-region'] } : step,
      ),
    };
    expect(findLessonProblems(lesson)).toContain(
      'step "color-face" references unknown color region "ghost-region"',
    );
  });

  it('rejects the picker fields a tile would otherwise render empty', () => {
    expect(findLessonProblems({ ...CAT_LESSON, title: ' ' })).toContain(
      'lesson has an empty title',
    );
    expect(findLessonProblems({ ...CAT_LESSON, subtitle: '' })).toContain(
      'lesson has an empty subtitle',
    );
    expect(
      findLessonProblems({ ...CAT_LESSON, targetPreview: { ...CAT_LESSON.targetPreview, paths: [] } }),
    ).toContain('targetPreview has no paths to draw');
  });

  it('rejects duplicate path ids in the target preview', () => {
    const preview = CAT_LESSON.targetPreview.paths[0]!;
    const lesson: LessonPackage = {
      ...CAT_LESSON,
      targetPreview: { ...CAT_LESSON.targetPreview, paths: [preview, preview] },
    };

    expect(findLessonProblems(lesson)).toContain(`duplicate target preview path id "${preview.id}"`);
  });

  it('refuses to open a package built for another schema version', () => {
    const lesson: LessonPackage = { ...CAT_LESSON, schemaVersion: LESSON_SCHEMA_VERSION + 1 };
    expect(() => assertValidLessons([lesson])).toThrow(LessonValidationError);
  });

  it('refuses a list where two packages claim the same lesson id', () => {
    const twin: LessonPackage = { ...CAT_LESSON, title: 'Kucing lain' };
    expect(() => assertValidLessons([CAT_LESSON, twin])).toThrow(
      new RegExp(`duplicate lesson id "${CAT_LESSON.id}"`),
    );
  });

  it('accepts a list of distinct valid packages', () => {
    expect(() => assertValidLessons([CAT_LESSON, FLOWER_LESSON])).not.toThrow();
  });
});

function withFirstStepGuide(lesson: LessonPackage, d: string): LessonPackage {
  const [first, ...rest] = lesson.steps;
  return {
    ...lesson,
    steps: [{ ...first!, guidePaths: [{ ...first!.guidePaths[0]!, d }] }, ...rest],
  };
}
