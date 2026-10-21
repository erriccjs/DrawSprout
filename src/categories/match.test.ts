import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../lesson-data';
import { pathBounds } from '../ui/preview-frame';
import { applyPhotoToLesson } from './apply';
import { DOG_CATEGORY } from './lessons/dog';
import { FLOWER_CATEGORY } from './lessons/flower';
import { doneCategory } from './library';
import { MATCH_CONFIDENCE, interpretMatch, normalizeHex } from './match';
import { mirrorPath } from './mirror';
import { matchRequestBody } from './openai';
import { matchCostUsd } from './pricing';

describe('photo match parsing', () => {
  it('accepts a confident done category and keeps only known part colours', () => {
    const match = interpretMatch({
      category: 'Flower',
      confidence: 0.91,
      facing: 'front',
      pose: 'bloom',
      colours: [
        { part: 'petals', color: '#ABCDEF' },
        { part: 'centre', color: 'kuning' },
        { part: 'leaves', color: '#123' },
        { part: 'vase', color: '#112233' },
        { part: 'petals', color: 'not-a-colour' },
      ],
    });
    expect(match.matched).toBe(true);
    expect(match.category).toBe('flower');
    expect(match.confidence).toBe(0.91);
    expect(match.colours).toEqual([
      { part: 'petals', color: '#abcdef' },
      { part: 'centre', color: '#f0c43a' },
      { part: 'leaves', color: '#112233' },
    ]);
    expect(match.suggestions).toEqual([]);
  });

  it('refuses a low score, an unknown subject, and a lesson that is only planned', () => {
    for (const raw of [
      { category: 'cat', confidence: MATCH_CONFIDENCE - 0.01, facing: 'front', pose: '', colours: [] },
      { category: 'dinosaur', confidence: 0.99, facing: 'left', pose: 'standing', colours: [] },
      { category: 'teapot', confidence: 80, facing: 'nope', pose: '', colours: [] },
      null,
    ]) {
      const match = interpretMatch(raw);
      expect(match.matched).toBe(false);
      expect(match.message).toMatch(/Belum bisa digambar/);
      expect(match.suggestions.map((item) => item.category)).toEqual(['cat', 'dog', 'flower', 'cup', 'toy-car', 'fish']);
    }
    expect(interpretMatch({ category: 'cat', confidence: 80, facing: 'left', pose: '', colours: [] }).confidence).toBe(0.8);
  });

  it('recolours only the colour step and mirrors a side view', () => {
    const entry = doneCategory('flower')!;
    const lesson = applyPhotoToLesson(entry, {
      facing: 'left',
      colours: [{ part: 'petals', color: '#102030' }],
    });
    const petals = lesson.steps.find((step) => step.id === 'color-petals')!;
    const centre = lesson.steps.find((step) => step.id === 'color-centre')!;
    expect(petals.toolPreset.color).toBe('#102030');
    expect(centre.toolPreset.color).toBe(FLOWER_CATEGORY.lesson.steps.find((step) => step.id === 'color-centre')!.toolPreset.color);
    expect(lesson.steps[0]?.toolPreset.color).toBe('#3a3a3a');
    expect(lesson.steps[0]?.guidePaths[0]?.d).toBe(entry.lesson.steps[0]?.guidePaths[0]?.d);

    const dog = applyPhotoToLesson(DOG_CATEGORY, {
      facing: 'left',
      colours: [{ part: 'fur', color: '#222222' }],
    });
    expect(dog.steps.find((step) => step.id === 'color-fur')?.toolPreset.color).toBe('#222222');
    const original = pathBounds(DOG_CATEGORY.lesson.steps[0]!.guidePaths[0]!.d)!;
    const flipped = pathBounds(dog.steps[0]!.guidePaths[0]!.d)!;
    const width = DOG_CATEGORY.lesson.coordinateSpace.width;
    expect(flipped.minX).toBeCloseTo(width - original.maxX, 0);
    expect(() => assertValidLessons([dog, lesson])).not.toThrow();
  });

  it('flips an arc sweep when a path is mirrored', () => {
    expect(mirrorPath('M 100 10 L 200 30', 1000)).toBe('M 900 10 L 800 30');
    expect(mirrorPath('M 100 10 200 30', 1000)).toBe('M 900 10 L 800 30');
    expect(mirrorPath('M 0 0 A 10 20 15 0 1 40 0', 100)).toBe('A 10 20 -15 0 0 60 0'.replace(/^/, 'M 100 0 '));
    expect(normalizeHex('#abc')).toBe('#aabbcc');
  });

  it('asks the vision model for a category and does not edit an image', () => {
    const body = JSON.stringify(matchRequestBody('gpt-4.1-mini', 'image/jpeg', 'aaaa'));
    expect(body).toContain('gpt-4.1-mini');
    expect(body).toContain('"detail":"low"');
    expect(body).toContain('"cat"');
    expect(body).toContain('"none"');
    expect(body).not.toMatch(/images\/edits|gpt-image/);
    expect(matchCostUsd({ inputTokens: 2_000, outputTokens: 150 })).toBeCloseTo(0.00104, 5);
  });
});
