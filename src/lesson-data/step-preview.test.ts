import { describe, expect, it } from 'vitest';
import { CAT_CATEGORY } from '../categories/lessons/cat';
import { CAT_LESSON } from './cat-lesson';
import { PREVIEW_INK, stepPreview } from './step-preview';

describe('step preview', () => {
  it('paints the new line red and leaves later lines off the page', () => {
    const preview = stepPreview(CAT_LESSON, 0);
    expect(preview.strokes).toEqual([
      { id: 'head', d: CAT_LESSON.steps[0]!.guidePaths[0]!.d, kind: 'new' },
    ]);
    expect(preview.fills).toEqual([]);
    expect(PREVIEW_INK.new).toBe('#e23b3b');
    expect(PREVIEW_INK.earlier).toBe('#2c2c2c');
  });

  it('keeps earlier lines dark when the next part is drawn', () => {
    const preview = stepPreview(CAT_LESSON, 1);
    expect(preview.strokes.map((stroke) => [stroke.id, stroke.kind])).toEqual([
      ['head', 'earlier'],
      ['ear-left', 'new'],
      ['ear-right', 'new'],
    ]);
  });

  it('drops a construction guide once its step is over', () => {
    const face = CAT_CATEGORY.lesson.steps.findIndex((step) => step.id === 'face');
    const whiskers = face + 1;
    const onFace = stepPreview(CAT_CATEGORY.lesson, face);
    expect(onFace.strokes.filter((stroke) => stroke.kind === 'construction').map((stroke) => stroke.id)).toEqual([
      'face-cross-v',
      'face-cross-h',
    ]);
    expect(PREVIEW_INK.construction).toBe('#b5b5b5');
    const later = stepPreview(CAT_CATEGORY.lesson, whiskers);
    expect(later.strokes.some((stroke) => stroke.id.startsWith('face-cross'))).toBe(false);
    expect(CAT_CATEGORY.lesson.targetPreview.paths.some((path) => path.id.startsWith('face-cross'))).toBe(false);
  });

  it('colours flat regions and keeps every final outline dark', () => {
    const index = CAT_LESSON.steps.findIndex((step) => step.id === 'color-fur');
    const preview = stepPreview(CAT_LESSON, index);
    expect(preview.strokes.every((stroke) => stroke.kind === 'earlier')).toBe(true);
    expect(preview.strokes.some((stroke) => stroke.id === 'head')).toBe(true);
    expect(preview.fills.some((fill) => fill.fill === '#e8a33d')).toBe(true);
    expect(preview.fills.some((fill) => fill.fill === 'paper')).toBe(true);
    expect(preview.activeOutlines.length).toBeGreaterThan(0);
  });
});
