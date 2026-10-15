import { describe, expect, it } from 'vitest';
import { CAT_LESSON } from './cat-lesson';
import { LESSON_SCHEMA_VERSION, type LessonPackage } from './schema';
import { LessonValidationError, assertValidLessons, findLessonProblems } from './validate';

describe('lesson package validation', () => {
  it('accepts the hand-authored cat lesson', () => {
    expect(findLessonProblems(CAT_LESSON)).toEqual([]);
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

  it('rejects duplicate path ids in previews and within each step', () => {
    const preview = CAT_LESSON.targetPreview.paths[0]!;
    const guide = CAT_LESSON.steps[0]!.guidePaths[0]!;
    const lesson: LessonPackage = {
      ...CAT_LESSON,
      targetPreview: { ...CAT_LESSON.targetPreview, paths: [preview, preview] },
      steps: [
        { ...CAT_LESSON.steps[0]!, guidePaths: [guide, guide] },
        ...CAT_LESSON.steps.slice(1),
      ],
    };

    expect(findLessonProblems(lesson)).toContain(`duplicate target preview path id "${preview.id}"`);
    expect(findLessonProblems(lesson)).toContain(`step "${CAT_LESSON.steps[0]!.id}" has duplicate guide path id "${guide.id}"`);
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
    const flower: LessonPackage = { ...CAT_LESSON, id: 'flower', title: 'Bunga' };
    expect(() => assertValidLessons([CAT_LESSON, flower])).not.toThrow();
  });
});

function withFirstStepGuide(lesson: LessonPackage, d: string): LessonPackage {
  const [first, ...rest] = lesson.steps;
  return {
    ...lesson,
    steps: [{ ...first!, guidePaths: [{ ...first!.guidePaths[0]!, d }] }, ...rest],
  };
}
