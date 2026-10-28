import { describe, expect, it } from 'vitest';
import { assertValidLessons } from '../lesson-data';
import { pathBounds } from '../ui/preview-frame';
import { applyPhotoToLesson } from './apply';
import { DOG_CATEGORY } from './lessons/dog';
import { FLOWER_CATEGORY } from './lessons/flower';
import { PERSON_STANDING_CATEGORY } from './lessons/person-standing';
import { CATEGORY_LESSONS, doneCategory } from './library';
import { MATCH_CONFIDENCE, interpretMatch, normalizeHex } from './match';
import { mirrorPath } from './mirror';
import { matchPrompt, matchRequestBody } from './openai';
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

  it('reads a string array, a part map, and the object shape', () => {
    const base = { category: 'flower', confidence: 0.9, facing: 'front', pose: '' };
    expect(interpretMatch({ ...base, colours: ['#a49f9a', '#b7b7b2'] }).colours).toEqual([
      { part: 'petals', color: '#a49f9a' },
      { part: 'centre', color: '#b7b7b2' },
    ]);
    expect(interpretMatch({ ...base, colours: ['nope', '#112233'] }).colours).toEqual([
      { part: 'centre', color: '#112233' },
    ]);
    expect(interpretMatch({
      ...base,
      colours: { leaves: '#3e9a55', petals: '#ff00aa', vase: '#000000' },
    }).colours).toEqual([
      { part: 'petals', color: '#ff00aa' },
      { part: 'leaves', color: '#3e9a55' },
    ]);
    expect(interpretMatch({
      ...base,
      colours: [{ part: 'Leaves', color: '#123' }, { part: 'petals', color: 'merah' }],
    }).colours).toEqual([
      { part: 'leaves', color: '#112233' },
      { part: 'petals', color: '#d64545' },
    ]);
  });

  it('opens the standing person and the cartoon head from the names a model may say', () => {
    const person = interpretMatch({
      category: 'person',
      confidence: 0.8,
      facing: 'front',
      pose: 'standing',
      colours: ['#f0c2a0', '#3a2e28', '#3d74c4', '#2c3d6e', '#6b4428', '#d24b45'],
    });
    expect(person.matched).toBe(true);
    expect(person.category).toBe('person-standing');
    expect(person.facing).toBe('front');
    expect(person.pose).toBe('standing');
    expect(person.colours.map((item) => item.part)).toEqual(PERSON_STANDING_CATEGORY.parts.map((part) => part.id));

    for (const category of ['man', 'woman', 'boy', 'girl', 'child', 'statue of a person', 'figure', 'people standing']) {
      const match = interpretMatch({ category, confidence: 0.8, facing: 'front', pose: 'standing', colours: [] });
      expect(match.matched).toBe(true);
      expect(match.category).toBe('person-standing');
    }
    for (const category of ['anime character', 'cartoon character', 'face', 'portrait', 'doll', 'action figure', 'superhero']) {
      const match = interpretMatch({ category, confidence: 0.9, facing: 'front', pose: '', colours: [] });
      expect(match.matched).toBe(true);
      expect(match.category).toBe('character');
    }

    const prompt = matchPrompt();
    expect(prompt).toContain('person-standing');
    expect(prompt).toContain('character');
    expect(prompt.split('\n').some((line) => line.startsWith('person:'))).toBe(false);
    expect(prompt).toContain('elephant');
    expect(prompt).toContain('teddy-bear');
    for (const category of ['teddy bear', 'teddy', 'stuffed bear']) {
      expect(interpretMatch({ category, confidence: 0.8, facing: 'front', pose: '', colours: [] }).category).toBe('teddy-bear');
    }
    expect(interpretMatch({ category: 'hen', confidence: 0.8, facing: 'right', pose: '', colours: [] }).category).toBe('chicken');
    expect(interpretMatch({ category: 'calf', confidence: 0.8, facing: 'right', pose: '', colours: [] }).category).toBe('cow');
  });

  it('refuses a low score, an unknown subject, and a lesson that is only planned', () => {
    for (const raw of [
      { category: 'cat', confidence: MATCH_CONFIDENCE - 0.01, facing: 'front', pose: '', colours: [] },
      { category: 'penguin', confidence: 0.99, facing: 'left', pose: 'standing', colours: [] },
      { category: 'teapot', confidence: 80, facing: 'nope', pose: '', colours: [] },
      null,
    ]) {
      const match = interpretMatch(raw);
      expect(match.matched).toBe(false);
      expect(match.message).toMatch(/Belum bisa digambar/);
      expect(match.suggestions.map((item) => item.category)).toEqual(CATEGORY_LESSONS.map((entry) => entry.id));
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
